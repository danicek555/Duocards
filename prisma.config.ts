import { defineConfig, env } from 'prisma/config';
import 'dotenv/config';

const datasourceUrl =
  process.env.DIRECT_DATABASE_URL || process.env.PRISMA_DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: datasourceUrl || env('PRISMA_DATABASE_URL'),
  },
});

