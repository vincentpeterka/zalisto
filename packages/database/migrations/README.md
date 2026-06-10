# Database Migrations

Migrace jsou plain SQL soubory. Drizzle Kit je spravuje.

## Spuštění migrace

```bash
# 1. Nastartuj postgres
cd infra && docker compose up postgres -d

# 2. Aplikuj všechny pending migrace
cd packages/database && pnpm migrate

# Nebo přímo přes psql:
psql postgresql://zalisto:zalisto@localhost:5432/zalisto -f migrations/0001_initial_schema.sql
```

## Adminer (DB GUI)

```bash
docker compose up postgres adminer -d
```
Otevři: http://localhost:8080

| Pole | Hodnota |
|------|---------|
| System | PostgreSQL |
| Server | postgres |
| Username | zalisto |
| Password | zalisto |
| Database | zalisto |

## Generování nové migrace ze schema změn

```bash
cd packages/database
pnpm migrate:generate
```
Drizzle Kit porovná `src/schema/` s aktuálním stavem DB a vygeneruje diff SQL.

## Konvence

- Čísla migrací: `NNNN_popis.sql` (4 číslice)
- Migrace jsou append-only — nikdy neupravuj committed migraci
- Každá migrace musí být bezpečně opakovatelná kde možné (`IF NOT EXISTS`)
- Nová migrace = nový soubor, i pro jeden ALTER TABLE
