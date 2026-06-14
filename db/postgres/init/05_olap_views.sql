CREATE OR REPLACE VIEW restaurant.vw_fact_pedidos_full AS
SELECT
    p.id AS pedido_id,

    p.fecha_hora,

    EXTRACT(YEAR FROM p.fecha_hora) AS anio,
    EXTRACT(MONTH FROM p.fecha_hora) AS mes,
    EXTRACT(DAY FROM p.fecha_hora) AS dia,

    u.id AS usuario_id,
    u.nombre AS usuario,

    r.id AS restaurante_id,
    r.nombre AS restaurante,

    r.latitud AS restaurante_latitud,
    r.longitud AS restaurante_longitud,

    p.latitud_entrega,
    p.longitud_entrega,

    ep.nombre AS estado_pedido,
    tp.nombre AS tipo_pedido,

    pl.id AS plato_id,
    pl.nombre AS plato,

    cp.nombre AS categoria,

    px.cantidad,
    pl.precio,

    (px.cantidad * pl.precio) AS ingreso
FROM pedido p
JOIN usuario u
    ON u.id = p.id_usuario
JOIN restaurante r
    ON r.id = p.id_restaurante
JOIN estado_pedido ep
    ON ep.id = p.id_estado_pedido
JOIN tipo_pedido tp
    ON tp.id = p.id_tipo_pedido
JOIN plato_x_pedido px
    ON px.id_pedido = p.id
JOIN plato pl
    ON pl.id = px.id_plato
LEFT JOIN categoria_plato cp
    ON cp.id = pl.id_categoria;

CREATE OR REPLACE VIEW vw_fact_pedidos AS
SELECT
    p.id AS pedido_id,
    p.id_usuario,
    p.id_restaurante,
    p.fecha_hora,
    p.fecha,
    p.precio_total,
    p.id_estado_pedido,
    p.id_tipo_pedido
FROM pedido p;

CREATE OR REPLACE VIEW vw_fact_reservaciones AS
SELECT
    r.id AS reservacion_id,
    r.id_usuario,
    r.id_restaurante,
    r.id_mesa,
    r.fecha_hora,
    r.duracion,
    r.cant_personas,
    r.id_estado_reservacion
FROM reservacion r;


CREATE OR REPLACE VIEW vw_fact_plato_pedido AS
SELECT
    pxp.id_pedido,
    pxp.id_plato,
    pxp.cantidad,
    pxp.subtotal,
    p.id_restaurante,
    p.fecha_hora,
    p.fecha
FROM plato_x_pedido pxp
JOIN pedido p ON p.id = pxp.id_pedido;


CREATE OR REPLACE VIEW vw_dim_usuario AS
SELECT
    id,
    nombre,
    correo,
    id_rol_usuario
FROM usuario;


CREATE OR REPLACE VIEW vw_dim_restaurante AS
SELECT
    id,
    nombre,
    direccion,
    latitud,
    longitud
FROM restaurante;


CREATE OR REPLACE VIEW vw_dim_plato AS
SELECT
    pl.id,
    pl.nombre,
    pl.precio,
    c.nombre AS categoria
FROM plato pl
LEFT JOIN categoria_plato c ON c.id = pl.id_categoria;