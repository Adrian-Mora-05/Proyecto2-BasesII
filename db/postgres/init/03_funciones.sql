\connect restaurantdb

SET search_path TO restaurant;

-- En Postgres se usan funciones en vez de SPs

-- 1. GetDetallesUser
CREATE OR REPLACE FUNCTION get_detalles_user(p_id INT)
RETURNS TABLE(
    id INT,
    nombre VARCHAR,
    correo VARCHAR,
    rol VARCHAR
)
LANGUAGE plpgsql
AS $$
BEGIN
RETURN QUERY
SELECT u.id, u.nombre, u.correo, r.nombre
FROM usuario u
JOIN rol_usuario r ON u.id_rol_usuario = r.id
WHERE u.id = p_id;
END;
$$;


-- 2. ActualizarUser
CREATE OR REPLACE FUNCTION actualizar_user(
    p_id INT,
    p_nombre VARCHAR,
    p_correo VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN

UPDATE usuario
SET nombre = p_nombre,
    correo = p_correo
WHERE id = p_id;

END;
$$;


-- 3. BorrarUser
CREATE OR REPLACE FUNCTION borrar_user(p_id INT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN

DELETE FROM usuario
WHERE id = p_id;

END;
$$;


--4. RegistrarRestaurante
CREATE OR REPLACE FUNCTION restaurant.registrar_restaurante(
    p_nombre VARCHAR,
    p_direccion TEXT,
    p_telefono VARCHAR
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE new_id INT;
BEGIN

INSERT INTO restaurant.restaurante (nombre, direccion, telefono)
VALUES (p_nombre, p_direccion, p_telefono)
RETURNING id INTO new_id;

RETURN new_id;

END;
$$;


--5. ListarRestaurantes
CREATE OR REPLACE FUNCTION listar_restaurantes()
RETURNS TABLE(
    id INT,
    nombre VARCHAR,
    direccion TEXT,
    telefono VARCHAR
)
LANGUAGE plpgsql
AS $$
BEGIN

RETURN QUERY
SELECT r.id,r.nombre,r.direccion,r.telefono
FROM restaurant.restaurante r;

END;
$$;


--6. CrearMenú
CREATE OR REPLACE FUNCTION restaurant.crear_menu(
    p_nombre VARCHAR,
    p_id_restaurante INT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE new_id INT;
BEGIN

INSERT INTO restaurant.menu AS m(nombre,id_restaurante)
VALUES(p_nombre,p_id_restaurante)
RETURNING m.id INTO new_id;

RETURN new_id;

END;
$$;


--7. GetDetallesMenú
CREATE OR REPLACE FUNCTION restaurant.get_detalles_menu(p_id INT)
RETURNS TABLE(
    id INT,
    nombre VARCHAR,
    id_restaurante INT,
    ultima_actualizacion TIMESTAMP
)
LANGUAGE plpgsql
AS $$
BEGIN

RETURN QUERY
SELECT m.id,m.nombre,m.id_restaurante,m.ultima_actualizacion
FROM restaurant.menu m
WHERE m.id = p_id;

END;
$$;


--8. ActualizarMenú
CREATE OR REPLACE FUNCTION restaurant.actualizar_menu(
    p_id INT,
    p_nombre VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN

UPDATE restaurant.menu m
SET nombre = p_nombre,
    ultima_actualizacion = CURRENT_TIMESTAMP
WHERE m.id = p_id;

END;
$$;


--9. BorrarMenú
CREATE OR REPLACE FUNCTION restaurant.borrar_menu(p_id INT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN

DELETE FROM restaurant.menu m
WHERE m.id = p_id;

END;
$$;


--10. Reservar
CREATE OR REPLACE FUNCTION restaurant.reservar(
    p_id_usuario INT,
    p_id_restaurante INT,
    p_id_mesa INT,
    p_fecha TIMESTAMP,
    p_duracion INT,
    p_personas INT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE 
    new_id INT;
    conflicto INT;
BEGIN

-- Verificar conflictos de horario
SELECT 1 INTO conflicto
FROM restaurant.reservacion r
WHERE r.id_mesa = p_id_mesa
AND r.id_estado_reservacion = 1
AND (
    p_fecha < (r.fecha_hora + (r.duracion || ' minutes')::INTERVAL)
    AND
    (p_fecha + (p_duracion || ' minutes')::INTERVAL) > r.fecha_hora
)
LIMIT 1;

IF conflicto IS NOT NULL THEN
    RAISE EXCEPTION 'La mesa ya está reservada en ese horario';
END IF;

INSERT INTO restaurant.reservacion(
    id_usuario,
    id_restaurante,
    id_mesa,
    fecha_hora,
    duracion,
    cant_personas,
    id_estado_reservacion
)
VALUES(
    p_id_usuario,
    p_id_restaurante,
    p_id_mesa,
    p_fecha,
    p_duracion,
    p_personas,
    1
)
RETURNING id INTO new_id;

RETURN new_id;

END;
$$;


--11. CancelarReservación
CREATE OR REPLACE FUNCTION cancelar_reserva(p_id INT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN

UPDATE restaurant.reservacion
SET id_estado_reservacion = 2
WHERE id = p_id;

END;
$$;


--12. RealizarPedido
CREATE OR REPLACE FUNCTION restaurant.realizar_pedido(
    p_id_usuario INT,
    p_id_restaurante INT,
    p_descripcion TEXT,
    p_tipo_pedido INT,
    p_platos JSON
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    new_id INT;
    item JSON;
    v_plato_id INT;
    v_cantidad INT;
    v_precio NUMERIC;
    v_subtotal NUMERIC;
    total NUMERIC := 0;
BEGIN

-- Crear pedido vacío primero
INSERT INTO restaurant.pedido(
    id_usuario,
    id_restaurante,
    descripcion,
    precio_total,
    id_estado_pedido,
    id_tipo_pedido
)
VALUES(
    p_id_usuario,
    p_id_restaurante,
    p_descripcion,
    0,
    1,
    p_tipo_pedido
)
RETURNING id INTO new_id;

-- Recorrer platos
FOR item IN SELECT * FROM json_array_elements(p_platos)
LOOP
    v_plato_id := (item->>'id_plato')::INT;
    v_cantidad := (item->>'cantidad')::INT;

    -- Obtener precio
    SELECT precio INTO v_precio
    FROM restaurant.plato
    WHERE id = v_plato_id;

    IF v_precio IS NULL THEN
        RAISE EXCEPTION 'Plato % no existe', v_plato_id;
    END IF;

    v_subtotal := v_precio * v_cantidad;
    total := total + v_subtotal;

    -- Insert detalle
    INSERT INTO restaurant.plato_x_pedido(
        id_plato,
        id_pedido,
        cantidad,
        subtotal
    )
    VALUES(
        v_plato_id,
        new_id,
        v_cantidad,
        v_subtotal
    );
END LOOP;

-- Actualizar total
UPDATE restaurant.pedido
SET precio_total = total
WHERE id = new_id;

RETURN new_id;

END;
$$;


--13. GetDetallesPedido
CREATE OR REPLACE FUNCTION get_detalles_pedido(p_id INT)
RETURNS TABLE(
    id INT,
    usuario INT,
    restaurante INT,
    descripcion TEXT,
    precio_total NUMERIC,
    estado INT,
    tipo INT
)
LANGUAGE plpgsql
AS $$
BEGIN

RETURN QUERY
SELECT p.id,
       p.id_usuario,
       p.id_restaurante,
       p.descripcion,
       p.precio_total,
       p.id_estado_pedido,
       p.id_tipo_pedido
FROM restaurant.pedido p
WHERE p.id = p_id;

END;
$$;