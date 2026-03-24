import { useState, useEffect, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchLocations,
  fetchMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleMenuItemAvailability,
} from '../api/client';
import type { MenuItem, MenuItemFormData } from '../types';

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item Form (shared by Add & Edit modals)
// ---------------------------------------------------------------------------

interface ItemFormProps {
  initialData?: Partial<MenuItemFormData>;
  onSubmit: (data: MenuItemFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  showLocationField?: boolean;
  locationId?: number;
}

function ItemForm({
  initialData = {},
  onSubmit,
  onCancel,
  isSubmitting,
  showLocationField = false,
  locationId,
}: ItemFormProps) {
  const [name, setName] = useState(initialData.name ?? '');
  const [description, setDescription] = useState(initialData.description ?? '');
  const [price, setPrice] = useState(String(initialData.price ?? ''));
  const [category, setCategory] = useState(initialData.category ?? '');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      price: parseFloat(price),
      category,
      ...(showLocationField && locationId ? { locationId } : {}),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Price ($)</label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Category</label>
          <input
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Burgers"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Menu Items Table
// ---------------------------------------------------------------------------

interface MenuTableProps {
  locationId: number;
}

function MenuTable({ locationId }: MenuTableProps) {
  const queryClient = useQueryClient();
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['menu-items', locationId],
    queryFn: () => fetchMenuItems(locationId),
  });

  const { mutate: addItem, isPending: isAdding } = useMutation({
    mutationFn: (data: MenuItemFormData) => createMenuItem({ ...data, locationId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['menu-items', locationId] });
      setShowAddModal(false);
    },
  });

  const { mutate: editItemMutate, isPending: isEditing } = useMutation({
    mutationFn: (data: MenuItemFormData) =>
      updateMenuItem(editItem!.id, {
        name: data.name,
        description: data.description,
        price: data.price,
        category: data.category,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['menu-items', locationId] });
      setEditItem(null);
    },
  });

  const { mutate: removeItem } = useMutation({
    mutationFn: deleteMenuItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['menu-items', locationId] });
    },
  });

  const { mutate: toggleAvailability } = useMutation({
    mutationFn: ({ id, isAvailable }: { id: number; isAvailable: boolean }) =>
      toggleMenuItemAvailability(id, isAvailable),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['menu-items', locationId] });
    },
  });

  const handleDelete = (item: MenuItem) => {
    if (window.confirm(`Delete "${item.name}"? This cannot be undone.`)) {
      removeItem(item.id);
    }
  };

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-gray-400">Loading menu items...</p>;
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          + Add Item
        </button>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left font-medium text-gray-500">Name</th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Category</th>
              <th className="px-5 py-3 text-right font-medium text-gray-500">Price</th>
              <th className="px-5 py-3 text-center font-medium text-gray-500">Available</th>
              <th className="px-5 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                  No menu items for this location.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-gray-400">{item.description}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">
                    ${item.price.toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() =>
                        toggleAvailability({ id: item.id, isAvailable: !item.isAvailable })
                      }
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        item.isAvailable ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      title={item.isAvailable ? 'Mark unavailable' : 'Mark available'}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                          item.isAvailable ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditItem(item)}
                        className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <Modal title="Add Menu Item" onClose={() => setShowAddModal(false)}>
          <ItemForm
            onSubmit={addItem}
            onCancel={() => setShowAddModal(false)}
            isSubmitting={isAdding}
            showLocationField
            locationId={locationId}
          />
        </Modal>
      )}

      {/* Edit Modal */}
      {editItem && (
        <Modal title={`Edit "${editItem.name}"`} onClose={() => setEditItem(null)}>
          <ItemForm
            initialData={editItem}
            onSubmit={editItemMutate}
            onCancel={() => setEditItem(null)}
            isSubmitting={isEditing}
          />
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Menu Page
// ---------------------------------------------------------------------------

export default function Menu() {
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: fetchLocations,
  });

  const [activeLocationId, setActiveLocationId] = useState<number | null>(null);

  useEffect(() => {
    if (locations.length > 0 && activeLocationId === null) {
      setActiveLocationId(locations[0].id);
    }
  }, [locations, activeLocationId]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">Loading locations...</p>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">No locations found.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Menu</h1>

      {/* Location Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1">
        {locations.map((loc) => (
          <button
            key={loc.id}
            onClick={() => setActiveLocationId(loc.id)}
            className={`whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeLocationId === loc.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {loc.name}
          </button>
        ))}
      </div>

      {activeLocationId !== null && <MenuTable locationId={activeLocationId} />}
    </div>
  );
}
