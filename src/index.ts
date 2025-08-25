#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from '@modelcontextprotocol/sdk/types.js';
import sql from 'mssql';

// Configuración de la base de datos
const dbConfig: sql.config = {
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    server: process.env.DB_SERVER || '',
    database: process.env.DB_NAME || '',
    options: {
        encrypt: true, // Usar true para Azure SQL
        trustServerCertificate: true, // Usar true para desarrollo local
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

class SQLServerMCPServer {
    private server: Server;
    private connectionPool: sql.ConnectionPool | null = null;

    constructor() {
        this.server = new Server(
            {
                name: 'sqlserver-mcp-server',
                version: '0.1.0',
            }
        );

        this.setupToolHandlers();
        this.setupErrorHandling();
    }

    private async initializeConnection(): Promise<void> {
        if (!this.connectionPool) {
            try {
                this.connectionPool = await sql.connect(dbConfig);
                console.error('Conectado a SQL Server exitosamente');
            } catch (error) {
                console.error('Error conectando a SQL Server:', error);
                throw new McpError(
                    ErrorCode.InternalError,
                    `Error de conexión a la base de datos: ${error}`
                );
            }
        }
    }

    private setupToolHandlers(): void {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'execute_query',
                    description: 'Ejecuta una consulta SQL SELECT en la base de datos',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'La consulta SQL SELECT a ejecutar',
                            },
                        },
                        required: ['query'],
                    },
                },
                {
                    name: 'list_tables',
                    description: 'Lista todas las tablas en la base de datos',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    name: 'describe_table',
                    description: 'Obtiene la estructura de una tabla específica',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            table_name: {
                                type: 'string',
                                description: 'Nombre de la tabla a describir',
                            },
                            schema_name: {
                                type: 'string',
                                description: 'Nombre del esquema (opcional, por defecto dbo)',
                                default: 'dbo',
                            },
                        },
                        required: ['table_name'],
                    },
                },
                {
                    name: 'get_sample_data',
                    description: 'Obtiene datos de muestra de una tabla',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            table_name: {
                                type: 'string',
                                description: 'Nombre de la tabla',
                            },
                            schema_name: {
                                type: 'string',
                                description: 'Nombre del esquema (opcional, por defecto dbo)',
                                default: 'dbo',
                            },
                            limit: {
                                type: 'number',
                                description: 'Número de registros a obtener (por defecto 10)',
                                default: 10,
                            },
                        },
                        required: ['table_name'],
                    },
                },
                {
                    name: 'search_tables',
                    description: 'Busca tablas que contengan un término en su nombre',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            search_term: {
                                type: 'string',
                                description: 'Término a buscar en los nombres de las tablas',
                            },
                        },
                        required: ['search_term'],
                    },
                },
            ],
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            await this.initializeConnection();

            switch (request.params.name) {
                case 'execute_query':
                    return this.executeQuery(request.params.arguments?.query as string);

                case 'list_tables':
                    return this.listTables();

                case 'describe_table':
                    return this.describeTable(
                        request.params.arguments?.table_name as string,
                        request.params.arguments?.schema_name as string || 'dbo'
                    );

                case 'get_sample_data':
                    return this.getSampleData(
                        request.params.arguments?.table_name as string,
                        request.params.arguments?.schema_name as string || 'dbo',
                        request.params.arguments?.limit as number || 10
                    );

                case 'search_tables':
                    return this.searchTables(request.params.arguments?.search_term as string);

                default:
                    throw new McpError(
                        ErrorCode.MethodNotFound,
                        `Herramienta desconocida: ${request.params.name}`
                    );
            }
        });
    }

    private async executeQuery(query: string) {
        if (!this.connectionPool) {
            throw new McpError(ErrorCode.InternalError, 'No hay conexión a la base de datos');
        }

        // Validación básica de seguridad - solo permitir SELECT
        const trimmedQuery = query.trim().toLowerCase();
        if (!trimmedQuery.startsWith('select')) {
            throw new McpError(
                ErrorCode.InvalidParams,
                'Solo se permiten consultas SELECT por seguridad'
            );
        }

        try {
            const result = await this.connectionPool.request().query(query);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            rowsAffected: result.rowsAffected,
                            recordset: result.recordset,
                            totalRows: result.recordset.length,
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new McpError(
                ErrorCode.InternalError,
                `Error ejecutando consulta: ${error}`
            );
        }
    }

    private async listTables() {
        if (!this.connectionPool) {
            throw new McpError(ErrorCode.InternalError, 'No hay conexión a la base de datos');
        }

        try {
            const result = await this.connectionPool.request().query(`
                SELECT
                    TABLE_SCHEMA,
                    TABLE_NAME,
                    TABLE_TYPE
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_TYPE = 'BASE TABLE'
                ORDER BY TABLE_SCHEMA, TABLE_NAME
            `);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result.recordset, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new McpError(
                ErrorCode.InternalError,
                `Error obteniendo lista de tablas: ${error}`
            );
        }
    }

    private async describeTable(tableName: string, schemaName: string = 'dbo') {
        if (!this.connectionPool) {
            throw new McpError(ErrorCode.InternalError, 'No hay conexión a la base de datos');
        }

        try {
            const result = await this.connectionPool.request()
                .input('schemaName', sql.VarChar, schemaName)
                .input('tableName', sql.VarChar, tableName)
                .query(`
                    SELECT
                        COLUMN_NAME,
                        DATA_TYPE,
                        IS_NULLABLE,
                        COLUMN_DEFAULT,
                        CHARACTER_MAXIMUM_LENGTH,
                        NUMERIC_PRECISION,
                        NUMERIC_SCALE,
                        ORDINAL_POSITION
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = @schemaName
                      AND TABLE_NAME = @tableName
                    ORDER BY ORDINAL_POSITION
                `);

            if (result.recordset.length === 0) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Tabla ${schemaName}.${tableName} no encontrada`
                );
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            schema: schemaName,
                            table: tableName,
                            columns: result.recordset,
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new McpError(
                ErrorCode.InternalError,
                `Error describiendo tabla: ${error}`
            );
        }
    }

    private async getSampleData(tableName: string, schemaName: string = 'dbo', limit: number = 10) {
        if (!this.connectionPool) {
            throw new McpError(ErrorCode.InternalError, 'No hay conexión a la base de datos');
        }

        try {
            const result = await this.connectionPool.request()
                .input('limit', sql.Int, limit)
                .query(`
                    SELECT TOP (@limit) *
                    FROM [${schemaName}].[${tableName}]
                `);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            schema: schemaName,
                            table: tableName,
                            sampleSize: result.recordset.length,
                            data: result.recordset,
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new McpError(
                ErrorCode.InternalError,
                `Error obteniendo datos de muestra: ${error}`
            );
        }
    }

    private async searchTables(searchTerm: string) {
        if (!this.connectionPool) {
            throw new McpError(ErrorCode.InternalError, 'No hay conexión a la base de datos');
        }

        try {
            const result = await this.connectionPool.request()
                .input('searchTerm', sql.VarChar, `%${searchTerm}%`)
                .query(`
                    SELECT
                        TABLE_SCHEMA,
                        TABLE_NAME,
                        TABLE_TYPE
                    FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_TYPE = 'BASE TABLE'
                      AND TABLE_NAME LIKE @searchTerm
                    ORDER BY TABLE_SCHEMA, TABLE_NAME
                `);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            searchTerm: searchTerm,
                            matches: result.recordset,
                            totalMatches: result.recordset.length,
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new McpError(
                ErrorCode.InternalError,
                `Error buscando tablas: ${error}`
            );
        }
    }

    private setupErrorHandling(): void {
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            if (this.connectionPool) {
                await this.connectionPool.close();
            }
            await this.server.close();
            process.exit(0);
        });
    }

    async run(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('SQL Server MCP server corriendo en stdio');
    }
}

const server = new SQLServerMCPServer();
server.run().catch(console.error);