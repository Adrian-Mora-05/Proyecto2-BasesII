\connect restaurantdb

SET search_path TO restaurant;

-- limpiar tablas de catálogo antes de insertar
TRUNCATE TABLE rol_usuario RESTART IDENTITY CASCADE;
TRUNCATE TABLE estado_reservacion RESTART IDENTITY CASCADE;
TRUNCATE TABLE estado_pedido RESTART IDENTITY CASCADE;
TRUNCATE TABLE tipo_pedido RESTART IDENTITY CASCADE;

INSERT INTO rol_usuario(nombre) VALUES
('admin'),
('cliente');

INSERT INTO estado_reservacion(nombre) VALUES
('reservada'),
('cancelada');

INSERT INTO estado_pedido(nombre) VALUES
('solicitado'),
('entregado'),
('cancelado');

INSERT INTO tipo_pedido(nombre) VALUES
('comer aquí'),
('para llevar');

INSERT INTO restaurant.restaurante (nombre, direccion, telefono) VALUES
('La Soda Tica', 'San José Centro', '2222-1111'),
('Pizza Planet', 'Escazú', '2222-2222');

INSERT INTO restaurant.mesa (id_restaurante, num_mesa, capacidad) VALUES
(1, 1, 4),
(1, 2, 2),
(2, 1, 6);

INSERT INTO restaurant.menu (nombre, id_restaurante) VALUES
('Menú Principal', 1),
('Menú Pizza', 2);

INSERT INTO restaurant.plato (id_menu, nombre, precio, descripcion, categoria) VALUES
(1, 'Casado',          3500, 'Comida típica costarricense', 'Típico'),
(1, 'Gallo Pinto',     2500, 'Desayuno típico',             'Desayuno'),
(1, 'Pancakes',        2500, 'Desayuno dulce',              'Desayuno'),
(2, 'Pizza Pepperoni', 8000, 'Pizza clásica',               'Pizza'),
(2, 'Pizza Hawaiana',  8500, 'Pizza con piña',              'Pizza');

-- ── Usuarios ──────────────────────────────────────────────────────
-- id_external_auth simula el UUID que asignaría Keycloak
INSERT INTO restaurant.usuario (id_external_auth, nombre, correo, id_rol_usuario) VALUES
('uuid-admin-001',    'Carlos Admin',   'carlos@admin.com',   1),
('uuid-cliente-001',  'María Pérez',    'maria@test.com',     2),
('uuid-cliente-002',  'Juan Mora',      'juan@test.com',      2),
('uuid-cliente-003',  'Laura Jiménez',  'laura@test.com',     2),
('uuid-cliente-004',  'Diego Rojas',    'diego@test.com',     2),
('uuid-cliente-005',  'Ana Vargas',     'ana@test.com',       2);

-- ── Reservaciones ─────────────────────────────────────────────────
INSERT INTO restaurant.reservacion 
  (id_usuario, id_restaurante, id_mesa, fecha_hora, duracion, cant_personas, id_estado_reservacion) 
VALUES
(2, 1, 1, '2027-06-01 12:00:00', 60,  4, 1),
(3, 1, 2, '2027-06-01 13:00:00', 45,  2, 1),
(4, 2, 3, '2027-06-02 19:00:00', 90,  5, 1),
(5, 1, 1, '2027-06-03 12:30:00', 60,  3, 2),
(6, 2, 3, '2027-06-03 20:00:00', 120, 6, 1);

-- ── Pedidos ───────────────────────────────────────────────────────
INSERT INTO restaurant.pedido 
  (id_usuario, id_restaurante, descripcion, id_tipo_pedido, id_estado_pedido) 
VALUES
(2, 1, 'Sin sal por favor',     1, 2),
(2, 1, 'Para llevar',           2, 2),
(3, 1, 'Bien cocido',           1, 2),
(3, 2, 'Extra queso',           1, 2),
(4, 2, 'Sin piña',              1, 1),
(4, 1, 'Para llevar rápido',    2, 2),
(5, 2, 'Todo normal',           1, 2),
(5, 1, 'Desayuno completo',     1, 2),
(6, 1, 'Para llevar',           2, 1),
(6, 2, 'Sin pepperoni',         1, 2);

-- ── Platos por pedido ─────────────────────────────────────────────
-- Pedido 1 — María pide Casado y Gallo Pinto
INSERT INTO restaurant.plato_x_pedido (id_pedido, id_plato, cantidad) VALUES
(1, 1, 1),
(1, 2, 1);

-- Pedido 2 — María pide Casado y Pancakes
INSERT INTO restaurant.plato_x_pedido (id_pedido, id_plato, cantidad) VALUES
(2, 1, 1),
(2, 3, 1);

-- Pedido 3 — Juan pide Casado y Gallo Pinto
INSERT INTO restaurant.plato_x_pedido (id_pedido, id_plato, cantidad) VALUES
(3, 1, 1),
(3, 2, 1);

-- Pedido 4 — Juan pide Pizza Pepperoni y Pizza Hawaiana
INSERT INTO restaurant.plato_x_pedido (id_pedido, id_plato, cantidad) VALUES
(4, 4, 1),
(4, 5, 1);

-- Pedido 5 — Diego pide Pizza Pepperoni y Pizza Hawaiana
INSERT INTO restaurant.plato_x_pedido (id_pedido, id_plato, cantidad) VALUES
(5, 4, 2),
(5, 5, 1);

-- Pedido 6 — Diego pide Casado y Gallo Pinto
INSERT INTO restaurant.plato_x_pedido (id_pedido, id_plato, cantidad) VALUES
(6, 1, 1),
(6, 2, 1);

-- Pedido 7 — Ana pide Pizza Pepperoni y Pizza Hawaiana
INSERT INTO restaurant.plato_x_pedido (id_pedido, id_plato, cantidad) VALUES
(7, 4, 1),
(7, 5, 2);

-- Pedido 8 — Ana pide Gallo Pinto y Pancakes
INSERT INTO restaurant.plato_x_pedido (id_pedido, id_plato, cantidad) VALUES
(8, 2, 1),
(8, 3, 2);

-- Pedido 9 — Laura pide Casado y Pancakes
INSERT INTO restaurant.plato_x_pedido (id_pedido, id_plato, cantidad) VALUES
(9, 1, 1),
(9, 3, 1);

-- Pedido 10 — Laura pide Pizza Pepperoni
INSERT INTO restaurant.plato_x_pedido (id_pedido, id_plato, cantidad) VALUES
(10, 4, 2);