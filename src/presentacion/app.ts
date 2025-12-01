import Fastify, {
  type FastifyError,
  type FastifyRequest,
  type FastifyReply,
  type FastifyInstance,
} from "fastify";
import {
  configuracion,
  validarConfiguracion,
} from "../common/configuracion.js";
import { pool } from "../core/infraestructura/postgres.js";

// Crea y configura la instancia de Fastify

function crearApp(): FastifyInstance {
  const app = Fastify({
    logger: configuracion.esDesarrollo
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
              colorize: true,
            },
          },
        }
      : true,
  });

  // Middleware de manejo de errores global

  app.setErrorHandler<FastifyError>(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      const statusCode = error.statusCode || 500;

      app.log.error({
        error: {
          message: error.message,
          stack: error.stack,
          statusCode,
        },
        request: {
          method: request.method,
          url: request.url,
          params: request.params,
          query: request.query,
        },
      });

      reply.status(statusCode).send({
        error: error.name || "Error",
        message: error.message || "Error interno del servidor",
        statusCode,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  );

  return app;
}

//Registra las rutas de la aplicación

function registrarRutas(app: FastifyInstance): void {
  // Health check básico
  app.get("/health", async (request, reply) => {
    const estadisticasPool = pool.obtenerEstadisticasPool();
    const estaConectadoDB = pool.obtenerEstadoConexion();

    return {
      estado: "ok",
      timestamp: new Date().toISOString(),
      baseDatos: {
        conectada: estaConectadoDB,
        pool: estadisticasPool,
      },
    };
  });

  // Prueba de consulta a la base de datos

  app.get("/db-test", async (request, reply) => {
    try {
      const resultado = await pool.ejecutarConsulta(
        "SELECT COUNT(*) as total FROM users"
      );

      return {
        exito: true,
        totalUsuarios: resultado.rows[0].total,
        mensaje: "Consulta ejecutada correctamente",
      };
    } catch (error) {
      reply.status(500);
      return {
        exito: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  });

  // AQUÍ VAN LAS RUTAS CUANDO SE IMPLEMENTEN RESPECTIVAMENTE
}

// Inicia el servidor y todas sus dependencias

export const startServer = async (): Promise<void> => {
  let app: FastifyInstance | null = null;

  try {
    // 1. Validar configuración
    console.log("🔍 Validando configuración...");
    validarConfiguracion();

    // 2. Crear aplicación Fastify
    console.log("⚙️  Creando aplicación Fastify...");
    app = crearApp();

    // 3. Probar conexión a la base de datos
    console.log("🗄️  Conectando a la base de datos...");
    await pool.probarConexion();

    // 4. Registrar rutas
    console.log("🛣️  Registrando rutas...");
    registrarRutas(app);

    // 5. Configurar graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n⚠️  Señal ${signal} recibida, cerrando servidor...`);

      try {
        if (app) {
          await app.close();
        }
        await pool.cerrar();
        console.log("✅ Servidor cerrado correctamente");
        process.exit(0);
      } catch (error) {
        console.error("❌ Error al cerrar el servidor:", error);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // 6. Iniciar servidor
    await app.listen({
      port: configuracion.servidor.puerto,
      host: configuracion.servidor.host,
    });

    // 7. Mostrar información de inicio
    console.log("\n" + "=".repeat(60));
    console.log("🚀 EVIL DROP Backend iniciado correctamente");
    console.log("=".repeat(60));
    console.log(
      `📍 Servidor: http://${configuracion.servidor.host}:${configuracion.servidor.puerto}`
    );
    console.log(`🗄️  Base de datos: ${configuracion.baseDatos.nombreDB}`);
    console.log(`🌍 Entorno: ${configuracion.entorno}`);
    console.log("=".repeat(60) + "\n");

    if (configuracion.esDesarrollo) {
      console.log("📋 Rutas disponibles:");
      app.printRoutes();
    }
  } catch (error) {
    console.error("\n❌ Error fatal al iniciar el servidor:");
    console.error(error);

    // Intentar cerrar la base de datos si está abierta
    try {
      await pool.cerrar();
    } catch (closeError) {
      // Ignorar errores al cerrar
    }

    const serverError = {
      code: "FST_ERR_INIT_SERVER",
      name: "ServidorError",
      statusCode: 500,
      message: `El servidor no se pudo iniciar: ${
        error instanceof Error ? error.message : "Error desconocido"
      }`,
    };

    throw serverError;
  }
};
