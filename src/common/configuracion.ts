interface BaseDatosConfig {
  host: string;
  puerto: number;
  nombreDB: string;
  usuario: string;
  contrasena: string;
  poolMax: number;
  tiempoEsperaInactivo: number;
  tiempoEsperaConexion: number;
}

interface ServidorConfig {
  puerto: number;
  host: string;
}

interface Configuracion {
  servidor: ServidorConfig;
  baseDatos: BaseDatosConfig;
  entorno: string;
  esProduccion: boolean;
  esDesarrollo: boolean;
}

export const configuracion: Configuracion = {
  servidor: {
    puerto: parseInt(process.env.PORT || "3000", 10),
    host: process.env.HOST || "0.0.0.0",
  },

  baseDatos: {
    host: process.env.DB_HOST || "localhost",
    puerto: parseInt(process.env.DB_PORT || "5432", 10),
    nombreDB: process.env.DB_NAME || "evildrop",
    usuario: process.env.DB_USER || "postgres",
    contrasena: process.env.DB_PASSWORD || "1234",
    poolMax: parseInt(process.env.DB_POOL_MAX || "20", 10),
    tiempoEsperaInactivo: parseInt(process.env.DB_IDLE_TIMEOUT || "30000", 10),
    tiempoEsperaConexion: parseInt(
      process.env.DB_CONNECTION_TIMEOUT || "2000",
      10
    ),
  },

  entorno: process.env.NODE_ENV || "development",
  esProduccion: process.env.NODE_ENV === "production",
  esDesarrollo: process.env.NODE_ENV !== "production",
};

// VALIDACIÓN DE QUE LAS VARIABLES DE ENTORNO CRÍTICAS ESTÉN CONFIGURADAS

export function validarConfiguracion(): void {
  const variablesRequeridas = ["DB_PASSWORD"];

  const faltantes = variablesRequeridas.filter(
    (variable) => !process.env[variable]
  );

  if (faltantes.length > 0 && configuracion.esProduccion) {
    throw new Error(
      `Faltan variables de entorno requeridas: ${faltantes.join(", ")}`
    );
  }

  // Validaciones adicionales
  if (configuracion.baseDatos.poolMax < 1) {
    throw new Error("DB_POOL_MAX debe ser mayor a 0");
  }

  if (
    configuracion.servidor.puerto < 1 ||
    configuracion.servidor.puerto > 65535
  ) {
    throw new Error("PORT debe estar entre 1 y 65535");
  }
}
