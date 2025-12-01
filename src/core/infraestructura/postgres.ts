// src/core/infraestructura/postgres.ts

import { Pool, type PoolClient, type QueryResult } from "pg";
import { configuracion } from "../../common/configuracion.js";

class ConexionPostgres {
  private static instancia: ConexionPostgres;
  private pool: Pool;
  private estaConectado: boolean = false;

  private constructor() {
    this.pool = new Pool({
      host: configuracion.baseDatos.host,
      port: configuracion.baseDatos.puerto,
      database: configuracion.baseDatos.nombreDB,
      user: configuracion.baseDatos.usuario,
      password: configuracion.baseDatos.contrasena,
      max: configuracion.baseDatos.poolMax,
      idleTimeoutMillis: configuracion.baseDatos.tiempoEsperaInactivo,
      connectionTimeoutMillis: configuracion.baseDatos.tiempoEsperaConexion,
    });

    // MANEJO DE ERRORES DEL POOL

    this.pool.on("error", (error) => {
      console.error("❌ Error inesperado en el pool de PostgreSQL:", error);
      this.estaConectado = false;
    });

    // Evento cuando se crea una nueva conexión
    this.pool.on("connect", () => {
      if (configuracion.esDesarrollo) {
        console.log("✅ Nueva conexión establecida con PostgreSQL");
      }
    });

    // Evento cuando se elimina una conexión
    this.pool.on("remove", () => {
      if (configuracion.esDesarrollo) {
        console.log("🗑️  Conexión eliminada del pool");
      }
    });
  }

  // Obtiene la instancia única de ConexionPostgres (Singleton)

  public static obtenerInstancia(): ConexionPostgres {
    if (!ConexionPostgres.instancia) {
      ConexionPostgres.instancia = new ConexionPostgres();
    }
    return ConexionPostgres.instancia;
  }

  //Prueba la conexión a la base de datos

  public async probarConexion(): Promise<void> {
    try {
      const cliente = await this.pool.connect();
      const resultado = await cliente.query("SELECT NOW() as tiempo_servidor");

      console.log("✅ Conexión exitosa a PostgreSQL");
      console.log(
        `   📅 Tiempo del servidor: ${resultado.rows[0].tiempo_servidor}`
      );
      console.log(`   🗄️  Base de datos: ${configuracion.baseDatos.nombreDB}`);

      this.estaConectado = true;
      cliente.release();
    } catch (error) {
      this.estaConectado = false;
      console.error("❌ Error al conectar con PostgreSQL:", error);
      throw error;
    }
  }

  //Ejecuta una consulta simple

  public async ejecutarConsulta<T extends Record<string, any> = any>(
    consulta: string,
    parametros?: any[]
  ): Promise<QueryResult<T>> {
    const inicio = Date.now();

    try {
      const resultado = await this.pool.query<T>(consulta, parametros);
      const duracion = Date.now() - inicio;

      if (configuracion.esDesarrollo) {
        console.log("📊 Query ejecutada:", {
          consulta: consulta.substring(0, 100) + "...",
          duracion: `${duracion}ms`,
          filas: resultado.rowCount,
        });
      }

      return resultado;
    } catch (error) {
      console.error("❌ Error en query:", {
        consulta,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  //Obtiene un cliente del pool para transacciones

  public async obtenerCliente(): Promise<PoolClient> {
    try {
      const cliente = await this.pool.connect();
      return cliente;
    } catch (error) {
      console.error("❌ Error al obtener cliente del pool:", error);
      throw error;
    }
  }

  //Ejecuta una transacción

  public async ejecutarTransaccion<T>(
    callback: (cliente: PoolClient) => Promise<T>
  ): Promise<T> {
    const cliente = await this.obtenerCliente();

    try {
      await cliente.query("BEGIN");
      const resultado = await callback(cliente);
      await cliente.query("COMMIT");

      if (configuracion.esDesarrollo) {
        console.log("✅ Transacción completada exitosamente");
      }

      return resultado;
    } catch (error) {
      await cliente.query("ROLLBACK");
      console.error("❌ Error en transacción, rollback ejecutado:", error);
      throw error;
    } finally {
      cliente.release();
    }
  }

  // Cierra todas las conexiones del pool

  public async cerrar(): Promise<void> {
    try {
      await this.pool.end();
      this.estaConectado = false;
      console.log("✅ Pool de conexiones cerrado correctamente");
    } catch (error) {
      console.error("❌ Error al cerrar el pool:", error);
      throw error;
    }
  }

  // Retorna el estado de la conexión

  public obtenerEstadoConexion(): boolean {
    return this.estaConectado;
  }

  // Obtiene estadísticas del pool

  public obtenerEstadisticasPool() {
    return {
      total: this.pool.totalCount,
      inactivas: this.pool.idleCount,
      enEspera: this.pool.waitingCount,
    };
  }
}

// Exportar la instancia única
export const pool = ConexionPostgres.obtenerInstancia();
