// Clave del pg_advisory_lock que serializa las migraciones entre réplicas.
// setup.ts la deriva del nombre del proyecto; no debe cambiar entre despliegues.
export const MIGRATION_LOCK_KEY = 1_918_273_645;
