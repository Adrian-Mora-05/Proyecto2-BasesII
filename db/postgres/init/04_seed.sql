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
(1, 'Casado', 3500, 'Comida típica costarricense', 'Típico'),
(1, 'Gallo Pinto', 2500, 'Desayuno típico', 'Desayuno'),
(1, 'Pancakes', 2500, 'Desayuno dulce', 'Desayuno'),
(2, 'Pizza Pepperoni', 8000, 'Pizza clásica', 'Pizza'),
(2, 'Pizza Hawaiana', 8500, 'Pizza con piña', 'Pizza');