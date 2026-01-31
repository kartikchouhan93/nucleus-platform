import boto3
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('S3TablesCheck')

def check_s3_tables():
    session = boto3.Session()
    # Check if 's3tables' is available in services
    available_services = session.get_available_services()
    if 's3tables' not in available_services:
        logger.error("Boto3 does not support 's3tables'. You may need to upgrade boto3/botocore.")
        return

    client = session.client('s3tables')
    try:
        logger.info("Listing S3 Table Buckets...")
        response = client.list_table_buckets()
        buckets = response.get('tableBuckets', [])
        logger.info(f"Found {len(buckets)} table buckets.")
        for b in buckets:
            logger.info(f" - {b['name']} ({b['arn']})")
            
    except Exception as e:
        logger.error(f"Error checking S3 tables: {e}")

if __name__ == "__main__":
    check_s3_tables()
