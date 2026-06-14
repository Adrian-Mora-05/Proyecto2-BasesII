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
('completado'),
('cancelado');

INSERT INTO tipo_pedido(nombre) VALUES
('comer aquí'),
('para llevar');

INSERT INTO restaurant.restaurante(
    nombre,
    direccion,
    telefono,
    latitud,
    longitud
)
VALUES
(
    'La Soda Tica',
    'San José Centro',
    '2222-1111',
    9.9325,
    -84.0796
),
(
    'Pizza Planet',
    'Escazú',
    '2222-2222',
    9.9187,
    -84.1394
);

INSERT INTO restaurant.mesa (id_restaurante, num_mesa, capacidad) VALUES
(1, 1, 4),
(1, 2, 2),
(2, 1, 6);

INSERT INTO restaurant.menu (nombre, id_restaurante) VALUES
('Menú Principal', 1),
('Menú Pizza', 2);

INSERT INTO categoria_plato(nombre) VALUES
('Típico'),
('Desayuno'),
('Pizza'),
('Postre'),
('Bebida'),
('Ensalada'),
('Sopa'),
('Pasta'),
('Mariscos'),
('Carne'),
('Vegetariano'),
('Vegano'),
('Sin gluten'),
('Sin lactosa'),
('Bajo en calorías'),
('Bajo en carbohidratos'),
('Bajo en grasas'),
('Alto en proteínas'),
('Orgánico'),
('Sin azúcar');

INSERT INTO restaurant.plato (id_menu, nombre, precio, descripcion, id_categoria) VALUES
(1, 'Casado',          3500, 'Comida típica costarricense', 1),
(1, 'Gallo Pinto',     2500, 'Desayuno típico',             2),
(1, 'Pancakes',        2500, 'Desayuno dulce',              2),
(2, 'Pizza Pepperoni', 8000, 'Pizza clásica',               3),
(2, 'Pizza Hawaiana',  8500, 'Pizza con piña',              3),
(1, 'Ensalada César',   3000, 'Ensalada con pollo y aderezo César', 6),
(1, 'Sopa de Mariscos', 4000, 'Sopa con variedad de mariscos frescos', 9),
(1, 'Pasta Alfredo',    4500, 'Pasta con salsa Alfredo cremosa', 8),
(1, 'Carne Asada',     5000, 'Carne asada a la parrilla con guarnición', 10),
(1, 'Hamburguesa Vegana', 3500, 'Hamburguesa hecha con ingredientes veganos', 12),
(2, 'Pizza Vegetariana', 7500, 'Pizza con variedad de vegetales frescos', 11),
(1, 'Postre de Chocolate', 2000, 'Delicioso postre de chocolate', 4),
(1, 'Limonada Natural', 1500, 'Refrescante limonada hecha con limones frescos', 5);

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
(6, 2, 3, '2027-06-03 20:00:00', 120, 6, 1),
(2, 2, 3, '2027-06-04 18:00:00', 90,  4, 1),
(3, 1, 2, '2027-06-04 19:30:00', 60,  2, 2),
(4, 2, 3, '2027-06-05 20:00:00', 120, 5, 1),
(5, 1, 1, '2027-06-05 12:00:00', 60,  3, 1),
(6, 2, 3, '2027-06-06 19:00:00', 90,  6, 2);

-- ── Pedidos ───────────────────────────────────────────────────────
INSERT INTO restaurant.pedido 
  (id_usuario, id_restaurante, descripcion, fecha_hora, latitud_entrega, longitud_entrega, id_tipo_pedido, id_estado_pedido) 
VALUES
(2, 1, 'Sin sal por favor',     '2027-06-01 12:00:00', 9.9325, -84.0796, 1, 2),
(2, 1, 'Para llevar',           '2027-06-01 13:00:00', 9.9325, -84.0796, 2, 2),
(3, 1, 'Bien cocido',           '2027-06-01 14:00:00', 9.9325, -84.0796, 1, 2),
(3, 2, 'Extra queso',           '2027-06-01 15:00:00', 9.9187, -84.1394, 1, 2),
(4, 2, 'Sin piña',              '2027-06-01 16:00:00', 9.9187, -84.1394, 1, 1),
(4, 1, 'Para llevar rápido',    '2027-06-01 17:00:00', 9.9325, -84.0796, 2, 2),
(5, 2, 'Todo normal',           '2027-06-01 18:00:00', 9.9187, -84.1394, 1, 2),
(5, 1, 'Desayuno completo',     '2027-06-01 19:00:00', 9.9325, -84.0796, 1, 2),
(6, 1, 'Para llevar',           '2027-06-01 20:00:00', 9.9325, -84.0796, 2, 1),
(6, 2, 'Sin pepperoni',         '2027-06-01 20:00:00', 9.9187, -84.1394, 1, 2),
(5, 1, 'Comida para la familia', '2027-06-01 21:00:00', 9.9325, -84.0796, 1, 2),
(4, 2, 'Pizza para la fiesta',   '2027-06-01 22:00:00', 9.9187, -84.1394, 1, 1),
(3, 1, 'Cena rápida',            '2027-06-01 23:00:00', 9.9325, -84.0796, 2, 2),
(2, 2, 'Almuerzo para llevar',   '2027-06-02 12:00:00', 9.9187, -84.1394, 2, 1),
(6, 1, 'Desayuno para llevar',   '2027-06-02 08:00:00', 9.9325, -84.0796, 2, 1),
(4, 1, 'Comida para la familia', '2027-06-02 13:00:00', 9.9325, -84.0796, 1, 2),
(5, 2, 'Pizza para la fiesta',   '2027-06-02 19:00:00', 9.9187, -84.1394, 1, 1);

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

UPDATE pedido p
SET precio_total = (
    SELECT SUM(px.cantidad * pl.precio)
    FROM plato_x_pedido px
    JOIN plato pl ON pl.id = px.id_plato
    WHERE px.id_pedido = p.id
);