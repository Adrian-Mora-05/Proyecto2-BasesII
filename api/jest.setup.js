// Carga el .env que está en la carpeta raíz del proyecto
// __dirname es la carpeta actual (api/)
// '../.env' sube un nivel y encuentra el .env en la raíz
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// En ES Modules no existe __dirname, hay que calcularlo así
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carga el .env desde la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../.env') });