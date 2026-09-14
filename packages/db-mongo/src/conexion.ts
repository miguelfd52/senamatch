import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar .env desde la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'senamatch';

if (!uri) {
  throw new Error('Falta la variable de entorno MONGODB_URI. Por favor, configúrala en el archivo .env');
}

class MongoConnection {
  private static instance: MongoClient;
  private static dbInstance: Db;

  /**
   * Establece o devuelve la conexión activa a MongoDB usando un patrón Singleton.
   */
  public static async connect(): Promise<{ client: MongoClient; db: Db }> {
    if (this.instance) {
      return { client: this.instance, db: this.dbInstance };
    }

    try {
      this.instance = new MongoClient(uri as string, {
        maxPoolSize: 10, // Reutilización de conexiones
      });

      await this.instance.connect();
      this.dbInstance = this.instance.db(dbName);
      
      console.log(`Conectado exitosamente a MongoDB Atlas (Base de datos: ${dbName})`);
      
      return { client: this.instance, db: this.dbInstance };
    } catch (error) {
      console.error('Error conectando a MongoDB Atlas:', error);
      throw error;
    }
  }

  /**
   * Obtiene la instancia de la base de datos.
   */
  public static getDb(): Db {
    if (!this.dbInstance) {
      throw new Error('Debes llamar a MongoConnection.connect() antes de obtener la base de datos.');
    }
    return this.dbInstance;
  }
  
  /**
   * Cierra la conexión a MongoDB.
   */
  public static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = undefined as any;
      this.dbInstance = undefined as any;
      console.log('Conexión a MongoDB cerrada.');
    }
  }
}

export default MongoConnection;
