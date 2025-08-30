import React, { useState } from 'react';
import { useDrop } from 'react-dnd';

interface DeleteZoneProps {
  onDelete: (componentId: string) => void;
}

export const DeleteZone: React.FC<DeleteZoneProps> = ({ onDelete }) => {
  const [{ isOver }, drop] = useDrop({
    accept: ['existing-component'],
    drop: (item: { type: string; id: string; componentType?: string }, monitor) => {
      // Only handle existing components being dragged outside
      if (item.type === 'existing-component' && item.id) {
        console.log('🗑️ Deleting component by drag outside:', item.id);
        onDelete(item.id);
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  });

  return (
    <div
      ref={drop}
      className={`delete-zone ${isOver ? 'delete-zone--active' : ''}`}
      data-testid="delete-zone"
    >
      {isOver && (
        <div className="delete-zone__indicator">
          <span className="delete-zone__icon">🗑️</span>
          <span className="delete-zone__text">Drop here to delete</span>
        </div>
      )}
    </div>
  );
};
