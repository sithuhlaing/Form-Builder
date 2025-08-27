import React, { useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import FormComponentRenderer from '../../molecules/forms/FormComponentRenderer';
import type { FormComponentData } from '../../../types';

interface DragDropReorderingItemProps {
  component: FormComponentData;
  index: number;
  selectedComponentId: string | null;
  onSelectComponent: (id: string | null) => void;
  onUpdateComponent: (updates: Partial<FormComponentData>) => void;
  onDeleteComponent: (id: string) => void;
  onMoveComponent: (dragIndex: number, hoverIndex: number) => void;
  onCreateRowLayout?: (draggedComponent: FormComponentData, targetComponent: FormComponentData, position: 'left' | 'right') => void;
  onAddToRowLayout?: (draggedComponent: FormComponentData, targetRowLayout: FormComponentData, position: 'left' | 'right') => void;
  onUpdateComponents?: (components: FormComponentData[]) => void;
  allComponents: FormComponentData[]; // Need access to all components to find parent row layouts
}

interface DragItem {
  type: string;
  id: string;
  index: number;
  component: FormComponentData;
}

const DragDropReorderingItem: React.FC<DragDropReorderingItemProps> = ({
  component,
  index,
  selectedComponentId,
  onSelectComponent,
  onUpdateComponent,
  onDeleteComponent,
  onMoveComponent,
  onCreateRowLayout,
  onAddToRowLayout,
  onUpdateComponents,
  allComponents
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [hoverPosition, setHoverPosition] = useState<'none' | 'top' | 'bottom' | 'left' | 'right' | 'center'>('none');

  // Helper function to find parent row layout
  const findParentRowLayout = (targetComponent: FormComponentData): FormComponentData | null => {
    for (const comp of allComponents) {
      if (comp.type === 'horizontal_layout' && comp.children) {
        if (comp.children.some(child => child.id === targetComponent.id)) {
          return comp;
        }
      }
    }
    return null;
  };

  // Drag functionality
  const [{ isDragging }, drag] = useDrag({
    type: 'reorder-component',
    item: (): DragItem => ({
      type: 'reorder-component',
      id: component.id,
      index,
      component,
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Drop functionality with hover logic
  const [{ handlerId }, drop] = useDrop({
    accept: ['reorder-component', 'component', 'horizontal-component'],
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: any, monitor) {
      if (!ref.current) {
        return;
      }
      
      // Check if this is a palette component or horizontal component
      const isPaletteComponent = !item.component && item.type && typeof item.type === 'string';
      const isHorizontalComponent = item.type === 'horizontal-component' && item.component;
      
      if (isPaletteComponent || isHorizontalComponent) {
        // For palette components and horizontal components, show positioning indicators
        const hoverBoundingRect = ref.current.getBoundingClientRect();
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) {
          setHoverPosition('none');
          return;
        }

        const width = hoverBoundingRect.width;
        const height = hoverBoundingRect.height;
        const x = clientOffset.x - hoverBoundingRect.left;
        const y = clientOffset.y - hoverBoundingRect.top;
        
        // Define edge zones (30% from each edge)
        const edgeZone = 0.3;
        const topZone = height * edgeZone;
        const bottomZone = height * (1 - edgeZone);
        const leftZone = width * edgeZone;
        const rightZone = width * (1 - edgeZone);
        
        let position: 'top' | 'bottom' | 'left' | 'right' | 'center' = 'center';
        
        if (y < topZone) {
          position = 'top';
        } else if (y > bottomZone) {
          position = 'bottom';
        } else if (x < leftZone) {
          position = 'left';
        } else if (x > rightZone) {
          position = 'right';
        } else {
          position = 'center';
        }
        
        setHoverPosition(position);
        return;
      }
      
      const dragIndex = item.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        setHoverPosition('none');
        return;
      }

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      
      // Determine mouse position
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) {
        setHoverPosition('none');
        return;
      }

      // Calculate cross-section regions (similar to smart positioning)
      const width = hoverBoundingRect.width;
      const height = hoverBoundingRect.height;
      
      const x = clientOffset.x - hoverBoundingRect.left;
      const y = clientOffset.y - hoverBoundingRect.top;
      
      // Define edge zones (30% from each edge)
      const edgeZone = 0.3;
      const topZone = height * edgeZone;
      const bottomZone = height * (1 - edgeZone);
      const leftZone = width * edgeZone;
      const rightZone = width * (1 - edgeZone);
      
      // Determine position based on cross-section logic
      let position: 'top' | 'bottom' | 'left' | 'right' | 'center' = 'center';
      
      if (y < topZone) {
        position = 'top';
      } else if (y > bottomZone) {
        position = 'bottom';
      } else if (x < leftZone) {
        position = 'left';
      } else if (x > rightZone) {
        position = 'right';
      } else {
        position = 'center';
      }
      
      setHoverPosition(position);

      // For top/bottom positions, use the original reordering logic
      if (position === 'top' || position === 'bottom') {
        const hoverMiddleY = height / 2;
        const hoverClientY = y;

        // Dragging downwards
        if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
          return;
        }

        // Dragging upwards
        if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
          return;
        }

        // Perform reordering move
        onMoveComponent(dragIndex, hoverIndex);
        item.index = hoverIndex;
      }
      // For left/right positions, we'll handle row layout creation in the drop handler
    },
    drop(item: any, monitor) {
      const finalPosition = hoverPosition;
      setHoverPosition('none');
      
      // Determine component type
      const isPaletteComponent = !item.component && item.type && typeof item.type === 'string';
      const isHorizontalComponent = item.type === 'horizontal-component' && item.component;
      
      if (isPaletteComponent) {
        // This is a new component from the palette
        console.log(`Individual component drop: new component ${item.type} at position ${finalPosition} relative to ${component.label}`);
        
        // For palette drops, let the parent canvas handle it but don't prevent the drop
        // The canvas will add the component appropriately
        return;
      }
      
      if (isHorizontalComponent) {
        // This is a component being moved from a row layout
        console.log(`Individual component drop: horizontal component ${item.component.label} at position ${finalPosition} relative to ${component.label}`);
        
        // For horizontal component drops, let the parent canvas handle it
        // The canvas will remove it from the row and add it to the appropriate position
        return;
      }
      
      // Handle existing component reordering and row layout creation
      if (item.component) {
        // Handle row layout creation/addition for left/right drops
        if (finalPosition === 'left' || finalPosition === 'right') {
          const parentRowLayout = findParentRowLayout(component);
          
          if (parentRowLayout && onAddToRowLayout) {
            // Target component is already in a row layout - add to existing row
            console.log(`Adding to existing row layout: dragged component ${finalPosition} of target in row ${parentRowLayout.id}`);
            onAddToRowLayout(item.component, parentRowLayout, finalPosition);
          } else if (onCreateRowLayout) {
            // Target component is not in a row layout - create new row
            console.log(`Creating new row layout: dragged component ${finalPosition} of target`);
            onCreateRowLayout(item.component, component, finalPosition);
          }
        }
        // Top/bottom drops are already handled in hover for smooth reordering
      }
    },
  });

  // Combine drag and drop refs
  drag(drop(ref));

  const opacity = isDragging ? 0.4 : 1;

  return (
    <div
      ref={ref}
      data-handler-id={handlerId}
      style={{
        opacity,
        position: 'relative',
        marginBottom: '16px',
        transition: 'all 0.2s ease',
        transform: isDragging ? 'rotate(2deg) scale(1.02)' : 'none',
      }}
    >
      {/* Drop indicators for all 4 positions */}
      {hoverPosition === 'top' && (
        <div
          style={{
            position: 'absolute',
            top: '-8px',
            left: 0,
            right: 0,
            height: '4px',
            backgroundColor: '#10b981',
            borderRadius: '2px',
            boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)',
            zIndex: 1000,
          }}
        />
      )}

      {hoverPosition === 'bottom' && (
        <div
          style={{
            position: 'absolute',
            bottom: '-8px',
            left: 0,
            right: 0,
            height: '4px',
            backgroundColor: '#10b981',
            borderRadius: '2px',
            boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)',
            zIndex: 1000,
          }}
        />
      )}

      {hoverPosition === 'left' && (
        <div
          style={{
            position: 'absolute',
            left: '-8px',
            top: 0,
            bottom: 0,
            width: '4px',
            backgroundColor: '#f59e0b',
            borderRadius: '2px',
            boxShadow: '0 0 8px rgba(245, 158, 11, 0.5)',
            zIndex: 1000,
          }}
        />
      )}

      {hoverPosition === 'right' && (
        <div
          style={{
            position: 'absolute',
            right: '-8px',
            top: 0,
            bottom: 0,
            width: '4px',
            backgroundColor: '#f59e0b',
            borderRadius: '2px',
            boxShadow: '0 0 8px rgba(245, 158, 11, 0.5)',
            zIndex: 1000,
          }}
        />
      )}

      {hoverPosition === 'center' && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '60px',
            height: '60px',
            border: '3px dashed #8b5cf6',
            borderRadius: '50%',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            boxShadow: '0 0 16px rgba(139, 92, 246, 0.3)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
          }}
        >
          🎯
        </div>
      )}

      {/* Main component container */}
      <div
        style={{
          padding: '12px',
          border: selectedComponentId === component.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
          borderRadius: '8px',
          backgroundColor: isDragging ? '#f3f4f6' : '#ffffff',
          boxShadow: selectedComponentId === component.id 
            ? '0 0 0 3px rgba(59, 130, 246, 0.1)' 
            : '0 1px 3px rgba(0, 0, 0, 0.1)',
          cursor: isDragging ? 'grabbing' : 'grab',
          position: 'relative',
        }}
        onClick={() => onSelectComponent(component.id)}
      >
        {/* Drag handle */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            width: '20px',
            height: '20px',
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            color: '#9ca3af',
            opacity: selectedComponentId === component.id ? 1 : 0.5,
            zIndex: 10,
          }}
          title="Drag to reorder"
        >
          ⋮⋮
        </div>

        {/* Delete button when selected */}
        {selectedComponentId === component.id && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteComponent(component.id);
            }}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: '24px',
              height: '24px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#ef4444',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              zIndex: 10,
            }}
            title="Delete component"
          >
            ×
          </button>
        )}

        {/* Component content */}
        <div style={{ marginLeft: '28px', marginRight: selectedComponentId === component.id ? '32px' : '8px' }}>
          <FormComponentRenderer
            component={component}
            selectedComponentId={selectedComponentId}
            onSelectComponent={onSelectComponent}
            onUpdateComponent={onUpdateComponent}
          />
        </div>
      </div>
    </div>
  );
};

export default DragDropReorderingItem;