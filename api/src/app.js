/**
 * app.js — Composición de dependencias e inyección.
 *
 * Responsabilidades:
 *  1. Leer DB_ENGINE del entorno.
 *  2. Establecer la conexión con el motor elegido.
 *  3. Instanciar DAOFactory (único IF de BD).
 *  4. Obtener DAOs e inyectarlos en los servicios.
 *  5. Inyectar servicios en controladores.
 *  6. Inyectar controladores en las rutas.
 *  7. Montar rutas en Express.
 *
 * A partir de aquí, ningún otro archivo sabe qué motor de BD se usa.
 */

import express from 'express';
import 'dotenv/config';

// ── Conexiones ────────────────────────────────────────────────────
import { pool }         from './config/postgresdb.js';
import { connectMongo } from './config/mongo.js';
import { DAOFactory }   from './dao/DAOFactory.js';

// ── Servicios ─────────────────────────────────────────────────────
import { AuthService }        from './services/auth.service.js';
import { UserService }        from './services/users.service.js';
import { RestaurantService }  from './services/restaurants.service.js';
import { MenuService }        from './services/menus.service.js';
import { OrderService }       from './services/orders.service.js';
import { ReservationService } from './services/reservations.service.js';

// ── Controladores ─────────────────────────────────────────────────
import { AuthController }        from './controllers/auth.controller.js';
import { UserController }        from './controllers/users.controller.js';
import { RestaurantController }  from './controllers/restaurants.controller.js';
import { MenuController }        from './controllers/menus.controller.js';
import { OrderController }       from './controllers/orders.controller.js';
import { ReservationController } from './controllers/reservations.controller.js';

// ── Rutas ─────────────────────────────────────────────────────────
import { createAuthRouter }        from './routes/auth.routes.js';
import { createUserRouter }        from './routes/users.routes.js';
import { createRestaurantRouter }  from './routes/restaurants.routes.js';
import { createMenuRouter }        from './routes/menus.routes.js';
import { createOrderRouter }       from './routes/orders.routes.js';
import { createReservationRouter } from './routes/reservations.routes.js';

export async function createApp() {
  const app = express();
  app.use(express.json());

  // ── 1. Resolver conexión según motor ────────────────────────────
  //    ÚNICO lugar donde DB_ENGINE determina qué conexión se usa.
  const engine = process.env.DB_ENGINE || 'postgres';
  const connection = engine === 'mongodb'
    ? await connectMongo()  // Retorna instancia `db` de Mongo
    : pool;                 // Pool de pg ya instanciado al importar

  // ── 2. Instanciar la fábrica ────────────────────────────────────
  //    DAOFactory tiene el ÚNICO IF que decide qué clases DAO usar.
  const factory = new DAOFactory(engine, connection);

  // ── 3. Obtener DAOs ─────────────────────────────────────────────
  const restaurantDAO  = factory.getDAO('restaurant');
  const menuDAO        = factory.getDAO('menu');
  const reservationDAO = factory.getDAO('reservation');
  const orderDAO       = factory.getDAO('order');
  const userDAO        = factory.getDAO('user');

  // ── 4. Instanciar servicios ─────────────────────────────────────
  //    OrderService y ReservationService reciben userDAO para resolver
  //    la identidad del usuario sin acoplarse al motor de BD.
  const authService        = new AuthService(userDAO);
  const userService        = new UserService(userDAO);
  const restaurantService  = new RestaurantService(restaurantDAO);
  const menuService        = new MenuService(menuDAO);
  const orderService       = new OrderService(orderDAO, userDAO, restaurantDAO);
  const reservationService = new ReservationService(reservationDAO, userDAO);

  // ── 5. Instanciar controladores ─────────────────────────────────
  const authController        = new AuthController(authService);
  const userController        = new UserController(userService);
  const restaurantController  = new RestaurantController(restaurantService);
  const menuController        = new MenuController(menuService);
  const orderController       = new OrderController(orderService);
  const reservationController = new ReservationController(reservationService);

  // ── 6. Montar rutas ─────────────────────────────────────────────
  app.use('/api/auth',         createAuthRouter(authController));
  app.use('/api/users',        createUserRouter(userController));
  app.use('/api/restaurants',  createRestaurantRouter(restaurantController));
  app.use('/api/menus',        createMenuRouter(menuController));
  app.use('/api/orders',       createOrderRouter(orderController));
  app.use('/api/reservations', createReservationRouter(reservationController));

  // ── Health check para Kubernetes ─────────────────────────────
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  return app;
}