import boto3
import os
import sys
import logging
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# Add current directory to path so we can import discovery
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the handler
import discovery

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('LocalRunner')

def get_env_vars_from_task_definition(app_name):
    """Fetch environment variables from the latest ECS Task Definition"""
    ecs = boto3.client('ecs')
    
    family_prefix = f"{app_name}-discovery-task"
    logger.info(f"Looking for latest task definition with family prefix: {family_prefix}")
    
    try:
        # List task definitions to find the latest one
        response = ecs.list_task_definitions(
            familyPrefix=family_prefix,
            sort='DESC',
            maxResults=1
        )
        
        task_def_arns = response.get('taskDefinitionArns', [])
        if not task_def_arns:
            logger.warning(f"No task definition found for family {family_prefix}")
            return {}
            
        latest_task_def_arn = task_def_arns[0]
        logger.info(f"Found latest task definition: {latest_task_def_arn}")
        
        # Describe task definition
        task_def_resp = ecs.describe_task_definition(taskDefinition=latest_task_def_arn)
        task_def = task_def_resp['taskDefinition']
        
        # Extract environment variables from the first container
        env_vars = {}
        if task_def.get('containerDefinitions'):
            container_def = task_def['containerDefinitions'][0]
            for env_pair in container_def.get('environment', []):
                env_vars[env_pair['name']] = env_pair['value']
                
        return env_vars
        
    except ClientError as e:
        logger.error(f"Error fetching task definition: {e}")
        return {}

def main():
    logger.info("Initializing Local Runner...")
    
    # 1. Load local .env if exists (optional override)
    load_dotenv()
    
    # 2. Fetch from AWS Task Definition (as requested by user)
    # determine app name from directory or env, default to 'nucleus-app'
    app_name = os.environ.get('APP_NAME', 'nucleus-app') 
    
    logger.info("Fetching environment variables from AWS ECS Task Definition...")
    remote_env_vars = get_env_vars_from_task_definition(app_name)
    
    if remote_env_vars:
        logger.info(f"Loaded {len(remote_env_vars)} environment variables from Task Definition.")
        for key, value in remote_env_vars.items():
            # Only set if not already set locally (local .env takes precedence for overrides if needed, 
            # but usually we want the remote values)
            if key not in os.environ:
                os.environ[key] = value
                logger.info(f"Set {key}={value}")
    else:
        logger.warning("Could not load environment variables from Task Definition. Ensure you have AWS credentials configured.")

    # 3. Validation
    required_vars = ['APP_TABLE_NAME', 'INVENTORY_TABLE_NAME']
    missing = [var for var in required_vars if var not in os.environ]
    if missing:
        logger.error(f"Missing required environment variables: {missing}")
        logger.error("Please ensure the CDK stack is deployed and the Task Definition exists, or set them in .env")
        sys.exit(1)

    # 4. Run Discovery
    logger.info("Running Discovery Logic...")
    try:
        result = discovery.handler({}, {})
        logger.info(f"Result: {result}")
    except Exception as e:
        logger.error(f"Execution Failed: {e}", exc_info=True)

if __name__ == "__main__":
    main()
