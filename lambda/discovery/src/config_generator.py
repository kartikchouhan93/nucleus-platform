"""
Configuration Generator for AWS Auto Inventory.
Generates YAML configuration for scanning resources.
"""
import yaml
from typing import Dict, Any, List


# Default resource types to scan
DEFAULT_RESOURCE_SHEETS = [
    # Compute Resources
    {
        'name': 'EC2Instances',
        'service': 'ec2',
        'function': 'describe_instances',
        'result_key': 'Reservations',
    },
    {
        'name': 'LambdaFunctions',
        'service': 'lambda',
        'function': 'list_functions',
        'result_key': 'Functions',
    },
    {
        'name': 'ECSClusters',
        'service': 'ecs',
        'function': 'list_clusters',
        'result_key': 'clusterArns',
    },
    {
        'name': 'ECSServices',
        'service': 'ecs',
        'function': 'list_services',
        'result_key': 'serviceArns',
    },
    {
        'name': 'AutoScalingGroups',
        'service': 'autoscaling',
        'function': 'describe_auto_scaling_groups',
        'result_key': 'AutoScalingGroups',
    },
    
    # Database Resources
    {
        'name': 'RDSInstances',
        'service': 'rds',
        'function': 'describe_db_instances',
        'result_key': 'DBInstances',
    },
    {
        'name': 'RDSClusters',
        'service': 'rds',
        'function': 'describe_db_clusters',
        'result_key': 'DBClusters',
    },
    {
        'name': 'DynamoDBTables',
        'service': 'dynamodb',
        'function': 'list_tables',
        'result_key': 'TableNames',
    },
    {
        'name': 'DocumentDBClusters',
        'service': 'docdb',
        'function': 'describe_db_clusters',
        'result_key': 'DBClusters',
    },
    
    # Storage Resources
    {
        'name': 'S3Buckets',
        'service': 's3',
        'function': 'list_buckets',
        'result_key': 'Buckets',
    },
    {
        'name': 'EBSVolumes',
        'service': 'ec2',
        'function': 'describe_volumes',
        'result_key': 'Volumes',
    },
    {
        'name': 'EFSFilesystems',
        'service': 'efs',
        'function': 'describe_file_systems',
        'result_key': 'FileSystems',
    },
    
    # Networking Resources
    {
        'name': 'VPCs',
        'service': 'ec2',
        'function': 'describe_vpcs',
        'result_key': 'Vpcs',
    },
    {
        'name': 'Subnets',
        'service': 'ec2',
        'function': 'describe_subnets',
        'result_key': 'Subnets',
    },
    {
        'name': 'LoadBalancers',
        'service': 'elbv2',
        'function': 'describe_load_balancers',
        'result_key': 'LoadBalancers',
    },
    {
        'name': 'NATGateways',
        'service': 'ec2',
        'function': 'describe_nat_gateways',
        'result_key': 'NatGateways',
    },
    
    # Security Resources
    {
        'name': 'SecurityGroups',
        'service': 'ec2',
        'function': 'describe_security_groups',
        'result_key': 'SecurityGroups',
    },
    {
        'name': 'KMSKeys',
        'service': 'kms',
        'function': 'list_keys',
        'result_key': 'Keys',
    },
    
    # Other Resources
    {
        'name': 'CloudFrontDistributions',
        'service': 'cloudfront',
        'function': 'list_distributions',
        'result_key': 'DistributionList',
    },
    {
        'name': 'SNSTopics',
        'service': 'sns',
        'function': 'list_topics',
        'result_key': 'Topics',
    },
    {
        'name': 'SQSQueues',
        'service': 'sqs',
        'function': 'list_queues',
        'result_key': 'QueueUrls',
    },
]

# Default regions to scan
DEFAULT_REGIONS = [
    'us-east-1',
    'us-west-2',
    'eu-west-1',
    'ap-south-1',
]


def generate_inventory_config(account: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate AWS Auto Inventory configuration for an account.
    
    Args:
        account: Account details including accountId, roleArn, regions
        
    Returns:
        Configuration dictionary for AWS Auto Inventory
    """
    account_id = account.get('accountId', 'unknown')
    regions = account.get('regions', DEFAULT_REGIONS)
    
    # If regions is a list of DynamoDB items, extract the strings
    if regions and isinstance(regions[0], dict) and 'S' in regions[0]:
        regions = [r.get('S', 'us-east-1') for r in regions]
    
    config = {
        'inventories': [
            {
                'name': f'nucleus-discovery-{account_id}',
                'aws': {
                    'profile': None,  # Uses ECS task role / assumed role
                    'region': regions,
                    'organization': False,  # We use role-based, not org-based
                },
                'excel': {
                    'transpose': True,
                },
                'sheets': DEFAULT_RESOURCE_SHEETS,
            }
        ]
    }
    
    return config


def save_config_to_yaml(config: Dict[str, Any], filepath: str) -> None:
    """Save configuration to a YAML file."""
    with open(filepath, 'w') as f:
        yaml.dump(config, f, default_flow_style=False)
