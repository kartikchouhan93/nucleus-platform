const { DynamoDBClient, PutItemCommand, ScanCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

const dynamodb = new DynamoDBClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

const logInfo = (message, data) => console.log(`INFO: ${message}`, JSON.stringify(data, null, 2));
const logError = (message, error) => console.error(`ERROR: ${message}`, error);

async function truncateTable() {
    try {
        const scanParams = { TableName: tableName };
        const { Items } = await dynamodb.send(new ScanCommand(scanParams));

        if (Items && Items.length > 0) {
            logInfo(`Found ${Items.length} items to delete`);

            for (const item of Items) {
                const deleteParams = {
                    TableName: tableName,
                    Key: { name: item.name, type: item.type }
                };
                await dynamodb.send(new DeleteItemCommand(deleteParams));
            }

            logInfo(`Successfully truncated table ${tableName}`);
        } else {
            logInfo(`Table ${tableName} is already empty`);
        }
    } catch (error) {
        logError(`Failed to truncate table ${tableName}`, error);
        throw error;
    }
}

async function insertItems(items) {
    let insertedCount = 0;
    for (const item of items) {
        const params = {
            TableName: tableName,
            Item: marshall(item)
        };

        try {
            await dynamodb.send(new PutItemCommand(params));
            insertedCount++;
            logInfo(`Inserted item`, item);
        } catch (error) {
            logError(`Failed to insert item`, { item, error });
            throw error;
        }
    }
    return insertedCount;
}

exports.handler = async (event) => {
    logInfo('Received event', event);

    if (!tableName) {
        throw new Error('DYNAMODB_TABLE_NAME environment variable is not set');
    }

    try {
        await truncateTable();

        const { metadata, metadataHash } = event;
        const insertedCount = await insertItems(metadata);

        logInfo(`Operation completed`, {
            tableNamed: tableName,
            itemsInserted: insertedCount
        });

        return {
            statusCode: 200,
            body: JSON.stringify(`Successfully inserted ${insertedCount} items into ${tableName}`)
        };
    } catch (error) {
        logError('Lambda execution failed', error);
        return {
            statusCode: 500,
            body: JSON.stringify('Internal server error')
        };
    }
};