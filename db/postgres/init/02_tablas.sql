\connect restaurantdb

SET search_path TO restaurant;

CREATE TABLE IF NOT EXISTS rol_usuario (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS estado_reservacion (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS estado_pedido (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS tipo_pedido (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS restaurante (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS usuario (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_external_auth VARCHAR(255),
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(150) UNIQUE NOT NULL,
    id_rol_usuario INT NOT NULL,
    FOREIGN KEY (id_rol_usuario)
        REFERENCES rol_usuario(id)
);

CREATE TABLE IF NOT EXISTS mesa (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_restaurante INT NOT NULL,
    num_mesa INT NOT NULL,
    capacidad INT NOT NULL,
    FOREIGN KEY (id_restaurante)
        REFERENCES restaurante(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mesa_restaurante ON mesa(id_restaurante);

CREATE TABLE IF NOT EXISTS reservacion (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_restaurante INT NOT NULL,
    id_mesa INT NOT NULL,
    fecha_hora TIMESTAMP NOT NULL,
    duracion INT NOT NULL,
    cant_personas INT NOT NULL,
    id_estado_reservacion INT NOT NULL,

    FOREIGN KEY (id_usuario)
        REFERENCES usuario(id)
        ON DELETE CASCADE,

    FOREIGN KEY (id_restaurante)
        REFERENCES restaurante(id)
        ON DELETE CASCADE,

    FOREIGN KEY (id_mesa)
        REFERENCES mesa(id)
        ON DELETE CASCADE,

    FOREIGN KEY (id_estado_reservacion)
        REFERENCES estado_reservacion(id)
);

CREATE TABLE IF NOT EXISTS menu (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100),
    id_restaurante INT NOT NULL,
    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_restaurante)
        REFERENCES restaurante(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_menu_restaurante ON menu(id_restaurante);

CREATE TABLE IF NOT EXISTS plato (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_menu INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    precio NUMERIC(10,2) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100),

    FOREIGN KEY (id_menu)
        REFERENCES menu(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pedido (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_restaurante INT NOT NULL,
    descripcion TEXT,
    precio_total NUMERIC(10,2),
    id_estado_pedido INT NOT NULL,
    id_tipo_pedido INT NOT NULL,

    FOREIGN KEY (id_usuario)
        REFERENCES usuario(id),

    FOREIGN KEY (id_restaurante)
        REFERENCES restaurante(id)
        ON DELETE CASCADE,

    FOREIGN KEY (id_estado_pedido)
        REFERENCES estado_pedido(id),

    FOREIGN KEY (id_tipo_pedido)
        REFERENCES tipo_pedido(id)
);

CREATE TABLE IF NOT EXISTS plato_x_pedido (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_plato INT NOT NULL,
    id_pedido INT NOT NULL,
    cantidad INT NOT NULL,
    subtotal NUMERIC(10,2),

    FOREIGN KEY (id_plato)
        REFERENCES plato(id)
        ON DELETE CASCADE,

    FOREIGN KEY (id_pedido)
        REFERENCES pedido(id)
        ON DELETE CASCADE
);