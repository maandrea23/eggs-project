import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

let pool: Pool | null = null;

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_DATABASE_URL;
}

function getPool() {
  if (pool) return pool;

  const uri = databaseUrl();
  if (uri) {
    pool = mysql.createPool({ uri, connectionLimit: 4 });
    return pool;
  }

  const host = process.env.MYSQL_HOST || process.env.DB_HOST;
  const user = process.env.MYSQL_USER || process.env.DB_USER;
  const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD;
  const database = process.env.MYSQL_DATABASE || process.env.DB_NAME;
  const port = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);

  if (!host || !user || !database) {
    throw new Error("La conexión de datos de la granja aún no está configurada.");
  }

  pool = mysql.createPool({ host, user, password, database, port, connectionLimit: 4 });
  return pool;
}

async function ensureFarmStateTable() {
  await getPool().execute(`
    create table if not exists farm_state (
      id varchar(64) primary key,
      data json not null,
      updated_at timestamp not null default current_timestamp on update current_timestamp
    )
  `);
}

export async function readFarmState(): Promise<Record<string, unknown> | null> {
  await ensureFarmStateTable();
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "select data from farm_state where id = ? limit 1",
    ["primary"],
  );
  const first = rows[0];
  if (!first?.data) return null;
  return typeof first.data === "string"
    ? (JSON.parse(first.data) as Record<string, unknown>)
    : (first.data as Record<string, unknown>);
}

export async function writeFarmState(state: Record<string, unknown>) {
  await ensureFarmStateTable();
  await getPool().execute(
    `
      insert into farm_state (id, data)
      values (?, cast(? as json))
      on duplicate key update data = values(data), updated_at = current_timestamp
    `,
    ["primary", JSON.stringify(state)],
  );
}
