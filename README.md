# SQL Server MCP Server

Un servidor MCP (Model Context Protocol) para conectar con bases de datos SQL Server y realizar consultas de manera segura.

## Características

- ✅ Conexión segura a SQL Server
- ✅ Ejecución de consultas SELECT
- ✅ Listado de tablas
- ✅ Descripción de estructura de tablas
- ✅ Obtención de datos de muestra
- ✅ Búsqueda de tablas por nombre
- ✅ Validación de consultas (solo SELECT por seguridad)

## Instalación

1. Clona o copia los archivos en tu directorio
2. Instala las dependencias:
```bash
npm install
```

3. Copia el archivo de configuración:
```bash
cp .env.example .env
```

4. Edita el archivo `.env` con tus credenciales de SQL Server:
```env
DB_SERVER=tu_servidor
DB_NAME=tu_base_de_datos
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
```

5. Compila el proyecto:
```bash
npm run build
```

## Uso

### Ejecución directa
```bash
npm start
```

### Configuración en Claude Desktop

Añade esta configuración a tu archivo de configuración de Claude Desktop:

**Windows:** `%APPDATA%/Claude/claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "sqlserver": {
      "command": "node",
      "args": ["/ruta/completa/a/tu/proyecto/dist/index.js"],
      "env": {
        "DB_SERVER": "tu_servidor",
        "DB_NAME": "tu_base_de_datos",
        "DB_USER": "tu_usuario",
        "DB_PASSWORD": "tu_contraseña"
      }
    }
  }
}
```

## Herramientas disponibles

### `execute_query`
Ejecuta una consulta SQL SELECT en la base de datos.
- **Parámetros:** `query` (string)
- **Restricciones:** Solo consultas SELECT por seguridad

### `list_tables`
Lista todas las tablas en la base de datos.
- **Parámetros:** ninguno

### `describe_table`
Obtiene la estructura de una tabla específica.
- **Parámetros:**
    - `table_name` (string, requerido)
    - `schema_name` (string, opcional, por defecto 'dbo')

### `get_sample_data`
Obtiene datos de muestra de una tabla.
- **Parámetros:**
    - `table_name` (string, requerido)
    - `schema_name` (string, opcional, por defecto 'dbo')
    - `limit` (number, opcional, por defecto 10)

### `search_tables`
Busca tablas que contengan un término en su nombre.
- **Parámetros:** `search_term` (string)

## Ejemplos de uso con Claude

Una vez configurado, puedes usar comandos como:

- "Lista todas las tablas de mi base de datos"
- "Describe la estructura de la tabla usuarios"
- "Muestra 5 registros de ejemplo de la tabla productos"
- "Busca tablas que contengan la palabra 'ventas'"
- "Ejecuta esta consulta: SELECT TOP 10 * FROM clientes WHERE activo = 1"

## Seguridad

- Solo se permiten consultas SELECT por seguridad
- Las conexiones usan encriptación por defecto
- Los parámetros se validan antes de ejecutar consultas
- No se almacenan credenciales en el código

## Desarrollo

Para desarrollo con recarga automática:
```bash
npm run dev
```

## Notas importantes

- Asegúrate de que tu usuario tenga permisos de lectura en las tablas
- Para Azure SQL Database, ajusta la configuración de `encrypt` si es necesario
- El servidor se conecta automáticamente cuando recibe la primera solicitud
- La conexión se mantiene activa usando un pool de conexiones