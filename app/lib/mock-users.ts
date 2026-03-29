export type User = {
  id: string;
  name: string;
  role: string;
  email: string;
};

export const USERS: User[] = [
  { id: "1", name: "Ana García", role: "Admin", email: "ana@example.com" },
  {
    id: "2",
    name: "Carlos López",
    role: "Editor",
    email: "carlos@example.com",
  },
  { id: "3", name: "María Pérez", role: "Viewer", email: "maria@example.com" },
];

export function getUserById(id: string): User | undefined {
  return USERS.find((u) => u.id === id);
}
