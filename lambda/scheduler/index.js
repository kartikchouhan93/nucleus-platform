const AWS = require('aws-sdk');
const moment = require('moment-timezone')
const { v4: uuidv4 } = require('uuid');
const pino = require('pino');



// Environment Variables
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE_NAME;
const SCHEDULAR_NAME = process.env.SCHEDULAR_NAME;
const SCHEDULE_TAG = process.env.SCHEDULER_TAG;
const AWS_REGION = process.env.AWS_DEFAULT_REGION
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN


const logger = pino({
    level: 'debug', // | info | debug
    transport: {
        target: 'pino-pretty',
        options: {
            translateTime: 'SYS:standard',
            ignore: 'hostname',
            messageFormat: '{msg}',
        },
    },
});


let runId = null;


exports.handler = async (event) => {
    runId = uuidv4();
    logger.info(`EXEC_ID: ${runId} - Process Environments Variable: ${JSON.stringify(process.env)}`);
    try {
        await startScheduler();
    } catch (error) {
        logger.error(`EXEC_ID: ${runId} - Error in scheduler: ${error}`);
        await sendErrorNotification(error.toString());
    }
};




async function fetchSchedulesMetaDataFromDynamoDb() {
    const dynamoDB = new AWS.DynamoDB.DocumentClient({ region: AWS_REGION }); // Set region here

    const params = {
        TableName: DYNAMODB_TABLE,
        FilterExpression: '#type = :typeVal and active = :activeVal',
        ExpressionAttributeNames: {
            '#type': 'type',
        },
        ExpressionAttributeValues: {
            ':typeVal': 'schedule',
            ':activeVal': true,
        },
    };

    try {
        const data = await dynamoDB.scan(params).promise();
        return data.Items;
    } catch (error) {
        logger.error('Error fetching schedules from DynamoDB:', error);
        return [];
    }
}

async function fetchAccountsMetaDataFromDynamoDb() {
    const dynamoDB = new AWS.DynamoDB.DocumentClient({ region: AWS_REGION }); // Set region here

    const params = {
        TableName: DYNAMODB_TABLE,
        FilterExpression: '#type = :typeVal and active = :activeVal',
        ExpressionAttributeNames: {
            '#type': 'type',
        },
        ExpressionAttributeValues: {
            ':typeVal': 'account_metadata', // Adjusted for account metadata
            ':activeVal': true,
        },
    };

    try {
        const data = await dynamoDB.scan(params).promise();
        return data.Items;
    } catch (error) {
        logger.error('Error fetching account metadata from DynamoDB:', error);
        return [];
    }
}


async function startScheduler() {
    logger.info(`EXEC_ID: ${runId}`);
    const schedules = await fetchSchedulesMetaDataFromDynamoDb();
    const awsAccounts = await fetchAccountsMetaDataFromDynamoDb();

    logger.info(`EXEC_ID: ${runId} - Found ${schedules.length} schedules and ${awsAccounts.length} AWS accounts`);
    logger.debug(`EXEC_ID: ${runId} - schedules ${JSON.stringify(schedules)}`);

    // Process each account and its regions concurrently
    const accountPromises = awsAccounts.map(async (account) => {
        const regionPromises = account.regions.map(async (region) => {
            const stsTempCredentials = await assumeRoleAndSetConfig(account.accountId, region, account.roleArn);
            const metadata = {
                account: {
                    name: account.name,
                    accountId: account.accountId,
                },
                region: region,
            };

            // Call the scheduler functions
            await Promise.all([
                ec2Schedular(schedules, stsTempCredentials, metadata),
                rdsSchedular(schedules, stsTempCredentials, metadata),
                ecsSchedular(schedules, stsTempCredentials, metadata),
            ]);
        });

        await Promise.all(regionPromises);
    });

    await Promise.all(accountPromises);
}



async function assumeRoleAndSetConfig(accountId, region, roleArn) {
    const STS = new AWS.STS();
    // const roleArn = `arn:aws:iam::${accountId}:role/YourCrossAccountRole`;
    // const roleSessionName = `session-${accountId}`;

    const roleSessionName = `session-${accountId}-${region}`;

    logger.debug(`EXEC_ID: ${runId} - Assuming role ${roleArn} for account ${accountId}`);

    const assumedRole = await STS.assumeRole({
        RoleArn: roleArn,
        RoleSessionName: roleSessionName,
    }).promise();


    // AWS.config.update({
    //     credentials: {
    //         accessKeyId: assumedRole.Credentials.AccessKeyId,
    //         secretAccessKey: assumedRole.Credentials.SecretAccessKey,
    //         sessionToken: assumedRole.Credentials.SessionToken
    //     },
    //     region: region
    // });

    return {
        credentials: {
            accessKeyId: assumedRole.Credentials.AccessKeyId,
            secretAccessKey: assumedRole.Credentials.SecretAccessKey,
            sessionToken: assumedRole.Credentials.SessionToken
        },
        region: region
    };

}


async function sendErrorNotification(errorMessage) {
    const sns = new AWS.SNS();
    const params = {
        Message: `Error in scheduler: ${errorMessage}`,
        Subject: 'Scheduler Error Notification',
        TopicArn: SNS_TOPIC_ARN,
    };
    try {
        await sns.publish(params).promise();
        logger.info(`Sent error notification via SNS`);
    } catch (err) {
        logger.error(`Failed to send error notification via SNS: ${err}`);
    }
}


async function elasticCacheSchedular() {
    // to be implemented 
}

async function ec2Schedular(schedules, stsTempCredentials, metadata) {
    const ec2AwsSdk = new AWS.EC2({
        credentials: stsTempCredentials.credentials,
        region: stsTempCredentials.region,
    });
    logger.info(`EXEC_ID: ${runId} - EC2 Scheduler started for ${metadata.account.name} (${metadata.account.accountId}) in ${metadata.region}`);
    logger.info(`EXEC_ID: ${runId} - EC2 Schedular - Started - ${metadata.account.name} (${metadata.account.accountId}) in ${metadata.region}`);

    try {
        // Retrieve all EC2 instances
        const instancesData = await ec2AwsSdk.describeInstances().promise();
        const instances = instancesData.Reservations.flatMap(reservation => reservation.Instances);

        // Filter instances with 'schedule' tag and exclude 'AmazonECSManaged' instances
        const scheduledInstances = instances.filter(instance =>
            instance.Tags.some(tag => tag.Key === SCHEDULE_TAG) &&
            !instance.Tags.some(tag => tag.Key === 'AmazonECSManaged' && tag.Value === 'true')
        );

        // Process instances concurrently
        const instanceProcessPromises = scheduledInstances.map(instance => processEc2Instance(instance, schedules));
        await Promise.all(instanceProcessPromises);

        logger.info(`EXEC_ID: ${runId} - EC2 Schedular - Completed - ${metadata.account.name} (${metadata.account.accountId}) in ${metadata.region} `);
    } catch (error) {
        logger.error(`EXEC_ID: ${runId} - EC2 Schedular - Error - ${metadata.account.name} (${metadata.account.accountId}) in ${metadata.region} :`, error);
    }


    async function processEc2Instance(instance, schedules) {

        const scheduleTag = instance.Tags.find(tag => tag.Key === SCHEDULE_TAG);
        const schedule = schedules.find(s => s.name === scheduleTag.Value);

        if (!schedule) {
            logger.debug(`EXEC_ID: ${runId} - Schedule "${scheduleTag.Value}" not found for instance ${instance.InstanceId}`);
            return;
        }

        logger.debug(`EXEC_ID: ${runId} - EC2 Schedular - Processing instance "${instance.InstanceId}" with schedule "${scheduleTag.Value}"`);

        if (isCurrentTimeInRange(schedule.starttime, schedule.endtime, schedule.timezone, schedule.days)) {
            if (instance.State.Name !== 'running') {
                try {
                    await ec2AwsSdk.startInstances({ InstanceIds: [instance.InstanceId] }).promise();
                    logger.info(`EXEC_ID: ${runId}- EC2 Schedular - Started instance: ${instance.InstanceId}`);
                } catch (error) {
                    logger.error(`EXEC_ID: ${runId} - EC2 Schedular - Error starting instance ${instance.InstanceId}: ${error}`);
                }

            } else {
                logger.info(`EXEC_ID: ${runId} - EC2 Schedular - Instance "${instance.InstanceId}" is already at desired state running`);
            }
        } else {
            if (instance.State.Name === 'running') {
                await ec2AwsSdk.stopInstances({ InstanceIds: [instance.InstanceId] }).promise();
                logger.info(`EXEC_ID: ${runId} - EC2 Schedular - Stopped instance: ${instance.InstanceId}`);
            } else {
                logger.info(`EXEC_ID: ${runId} - EC2 Schedular - Instance "${instance.InstanceId}" is already at desired state stopped`);
            }
        }
    }


}


async function rdsSchedular(schedules, stsTempCredentials, metadata) {
    const rdsAwsSdk = new AWS.RDS({
        credentials: stsTempCredentials.credentials,
        region: stsTempCredentials.region,
    });
    logger.info(`EXEC_ID: ${runId} - RDS Scheduler started for ${metadata.account.name} (${metadata.account.accountId}) in ${metadata.region}`);
    logger.info(`EXEC_ID: ${runId} - RDS Schedular - Started - ${metadata.account.name} (${metadata.account.accountId}) in ${metadata.region}`);

    try {
        const dbInstancesData = await rdsAwsSdk.describeDBInstances().promise();
        const dbInstances = dbInstancesData.DBInstances;

        logger.debug(`EXEC_ID: ${runId} - RDS Schedular - Found ${dbInstances.length} RDS instances for ${metadata.account.name} (${metadata.account.accountId}) in ${metadata.region}`);

        // Create a list of promises for processing each RDS instance
        const dbInstanceProcessPromises = dbInstances.map(instance => processRDSInstance(instance, schedules));

        // Process all RDS instances concurrently
        await Promise.all(dbInstanceProcessPromises);

        logger.info(`EXEC_ID: ${runId} - RDS Schedular - Completed - ${metadata.account.name} (${metadata.account.accountId}) in ${metadata.region}`);
    } catch (error) {
        logger.error(`EXEC_ID: ${runId} - RDS Schedular - Error - ${metadata.account.name} (${metadata.account.accountId}) in ${metadata.region} :`, error);
    }


    async function processRDSInstance(instance, schedules) {

        try {
            const tagsData = await rdsAwsSdk.listTagsForResource({ ResourceName: instance.DBInstanceArn }).promise();
            const scheduleTag = tagsData.TagList.find(tag => tag.Key === SCHEDULE_TAG);
            if (!scheduleTag) return;

            logger.debug(`EXEC_ID: ${runId} - RDS Schedular - Processing instance "${instance.DBInstanceIdentifier}" with schedule "${scheduleTag.Value}"`);

            const schedule = schedules.find(s => s.name === scheduleTag.Value);
            if (!schedule) {
                logger.debug(`EXEC_ID: ${runId} - RDS Schedular - Schedule "${scheduleTag.Value}" not found for instance ${instance.DBInstanceIdentifier}`);
                return;
            }

            logger.debug(`EXEC_ID: ${runId} - RDS Schedular - RDS instance "${instance.DBInstanceIdentifier}" is tagged with "${scheduleTag.Value}" schedule`);

            if (isCurrentTimeInRange(schedule.starttime, schedule.endtime, schedule.timezone, schedule.days)) {
                if (instance.DBInstanceStatus !== 'available') {
                    await rdsAwsSdk.startDBInstance({ DBInstanceIdentifier: instance.DBInstanceIdentifier }).promise();
                    logger.info(`EXEC_ID: ${runId} - RDS Schedular - RDS instance "${instance.DBInstanceIdentifier}" started`);
                } else {
                    logger.info(`EXEC_ID: ${runId} - RDS Schedular - RDS instance "${instance.DBInstanceIdentifier}" is already at desired state running`);
                }
            } else {
                if (instance.DBInstanceStatus === 'available') {
                    await rdsAwsSdk.stopDBInstance({ DBInstanceIdentifier: instance.DBInstanceIdentifier }).promise();
                    logger.info(`EXEC_ID: ${runId} - RDS Schedular - RDS instance Stopped: ${instance.DBInstanceIdentifier}`);
                } else {
                    logger.info(`EXEC_ID: ${runId} - RDS Schedular - RDS instance "${instance.DBInstanceIdentifier}" is already at desired state stopped`);
                }
            }
        } catch (error) {
            logger.error(`EXEC_ID: ${runId} - RDS Schedular - Error processing RDS instance ${instance.DBInstanceIdentifier}: ${error}`);
        }
    }




}



async function ecsSchedular(schedules, stsTempCredentials, metadata) {
    const ecsAwsSdk = new AWS.ECS({
        credentials: stsTempCredentials.credentials,
        region: stsTempCredentials.region,
    });
    const asgAwsSdk = new AWS.AutoScaling({
        credentials: stsTempCredentials.credentials,
        region: stsTempCredentials.region,
    });
    logger.info(`EXEC_ID: ${runId} - ECS Scheduler started for ${metadata.account.name} (${metadata.account.accountId}) in ${metadata.region}`);
    logger.info(`EXEC_ID: ${runId} - ECS Schedular - Started - ${metadata.account.name} (${metadata.account.accountId}) in ${metadata.region}`);

    try {
        const ecsClusters = await ecsAwsSdk.listClusters().promise();
        logger.debug(`EXEC_ID: ${runId} - ECS Schedular - Found ${ecsClusters.clusterArns.length} ECS Clusters`);

        const clusterUpdatePromises = ecsClusters.clusterArns.map(async clusterArn => {
            logger.debug(`EXEC_ID: ${runId} - ECS Schedular - Processing ECS Cluster: ${clusterArn}`);

            const clusterDetails = await getEcsClusterDetails(clusterArn);
            if (!hasTag(clusterDetails.tags, SCHEDULE_TAG)) {
                logger.debug(`EXEC_ID: ${runId} - ECS Schedular - No 'schedule' tag found for Cluster: ${clusterArn}, skipping`);
                return;
            }

            const ecsServicesList = await ecsAwsSdk.listServices({ cluster: clusterArn }).promise();
            await ecsServiceScheduler(clusterArn, ecsServicesList.serviceArns, schedules);
            await ecsClusterScheduler(clusterArn, schedules);
        });

        // Run updates for all clusters concurrently
        await Promise.all(clusterUpdatePromises);
        logger.info(`EXEC_ID: ${runId} - ECS Schedular - Completed - ${metadata.account.name} (${metadata.account.accountId}) in ${metadata.region}`);
    } catch (error) {
        logger.error(`EXEC_ID: ${runId} - ECS Schedular - Error - ${metadata.account.name} (${metadata.account.accountId}) in ${metadata.region} :`, error);
    }

    async function ecsClusterScheduler(clusterArn, schedules) {
        logger.info(`EXEC_ID: ${runId} - ECS Schedular - Starting ASG update for cluster: ${clusterArn}`);

        const asgNames = await getAllAsgNamesForEcsCluster(clusterArn);
        logger.debug(`EXEC_ID: ${runId} - ECS Schedular - Found ${asgNames.length} ASGs for cluster: ${clusterArn}`);
        if (!asgNames.length) {
            logger.debug(`EXEC_ID: ${runId} - ECS Schedular - No ASGs found for cluster: ${clusterArn}`);
            return;
        }

        const clusterDetails = await getEcsClusterDetails(clusterArn);
        const scheduleTagValue = getTagValue(clusterDetails.tags, SCHEDULE_TAG);
        const schedule = getScheduleDetails(schedules, scheduleTagValue);

        if (!schedule) {
            logger.debug(`EXEC_ID: ${runId} - ECS Schedular - No matching schedule found for cluster: ${clusterArn}`);
            return;
        }

        const desiredCapacity = isCurrentTimeInRange(schedule.starttime, schedule.endtime, schedule.timezone, schedule.days) ? 1 : 0;
        logger.info(`EXEC_ID: ${runId} - ECS Schedular - Desired capacity for ASGs in cluster ${clusterArn}: ${desiredCapacity}`);

        const asgUpdatePromises = asgNames.map(asgName => updateAutoScalingGroupCount(asgName, desiredCapacity));

        // Update all ASGs concurrently
        await Promise.all(asgUpdatePromises);
        logger.debug(`EXEC_ID: ${runId} - ECS Schedular - Completed ASG updates for cluster: ${clusterArn}`);
    }



    async function ecsServiceScheduler(clusterArn, serviceArns, schedules) {
        logger.info(`EXEC_ID: ${runId} - ECS Schedular - starting service updates in cluster: ${clusterArn}`);

        const serviceUpdatePromises = serviceArns.map(async serviceArn => {
            const serviceDetails = await getEcsServiceDetails(serviceArn);
            if (!hasTag(serviceDetails.tags, SCHEDULE_TAG)) {
                logger.debug(`EXEC_ID: ${runId} - ECS Schedular - Service ${serviceArn} does not have 'schedule' tag`);
                return;
            }

            const scheduleTagValue = getTagValue(serviceDetails.tags, SCHEDULE_TAG);
            const schedule = getScheduleDetails(schedules, scheduleTagValue);
            if (!schedule) {
                logger.debug(`EXEC_ID: ${runId} - ECS Schedular - No matching schedule found for service ${serviceArn}`);
                return;
            }

            const desiredCount = isCurrentTimeInRange(schedule.starttime, schedule.endtime, schedule.timezone, schedule.days) ? 1 : 0;
            logger.debug(`EXEC_ID: ${runId} - ECS Schedular - Updating service ${serviceArn} to desired count: ${desiredCount}`);
            await updateEcsServiceCount(clusterArn, serviceArn, desiredCount, serviceDetails);
        });

        // Update all services concurrently
        await Promise.all(serviceUpdatePromises);
        logger.info(`EXEC_ID: ${runId} - ECS Schedular - Completed service updates in cluster: ${clusterArn}`);
    }



    // ========================== Helper Functions ==========================

    function getTagValue(tags, lookupKey) {
        const tag = tags.find(tag => tag.key === lookupKey);
        return tag ? tag.value : null;
    }

    function hasTag(tags, lookupKey) {
        return tags.some(tag => tag.key === lookupKey);
    }


    function getScheduleDetails(schedules, scheduleName) {
        return schedules.find(s => s.name === scheduleName);
    }

    async function getEcsClusterDetails(clusterArn) {


        try {
            // Describe the cluster to get basic details
            const clusterDetails = await ecsAwsSdk.describeClusters({ clusters: [clusterArn] }).promise();

            // Fetch tags separately
            const tagsResponse = await ecsAwsSdk.listTagsForResource({ resourceArn: clusterArn }).promise();
            const tags = tagsResponse.tags;

            // Combine the details and tags
            return {
                ...clusterDetails.clusters[0],
                tags: tags
            };
        } catch (error) {
            logger.error(`Error getting ECS cluster details: ${error}`);
            return null;
        }
    }



    async function getEcsServiceDetails(serviceArn) {
        logger.debug(`EXEC_ID: ${runId} - Getting ECS service details for ${serviceArn}`);

        try {
            const parts = serviceArn.split('/');
            const clusterName = parts[parts.length - 2];
            const serviceName = parts[parts.length - 1];

            const serviceDetails = await ecsAwsSdk.describeServices({
                cluster: clusterName,
                services: [serviceName]
            }).promise();

            const tagsResponse = await ecsAwsSdk.listTagsForResource({ resourceArn: serviceArn }).promise();
            const tags = tagsResponse.tags;

            return {
                ...serviceDetails.services[0],
                events: [],
                tags: tags
            };
        } catch (error) {
            logger.error(`EXEC_ID: ${runId} - Error getting ECS service details: ${error}`);
            return null;
        }
    }


    async function updateEcsServiceCount(clusterArn, serviceArn, desiredCount, currentServiceDetails) {
        logger.debug(`EXEC_ID: ${runId} - Updating ECS service count for ${serviceArn}`);

        try {
            if (!currentServiceDetails) {
                currentServiceDetails = await getEcsServiceDetails(serviceArn);
            }

            const currentDesiredCount = currentServiceDetails.desiredCount;

            if (currentDesiredCount === desiredCount) {
                logger.info(`EXEC_ID: ${runId} - ECS Schedular - Service "${serviceArn}" is already at desired count: ${desiredCount}`);
                return;
            }

            const serviceName = currentServiceDetails.serviceName;
            const params = {
                cluster: clusterArn,
                service: serviceName,
                desiredCount: desiredCount
            };
            await ecsAwsSdk.updateService(params).promise();
            logger.info(`EXEC_ID: ${runId} - ECS Schedular - Updated service "${serviceName}" to desired count: ${desiredCount}`);
        } catch (error) {
            logger.error(`EXEC_ID: ${runId} - ECS Schedular - Error updating service count for "${serviceArn}": ${error}`);
            throw error;
        }
    }


    async function getAllAsgNamesForEcsCluster(clusterArn) {
        logger.debug(`EXEC_ID: ${runId} - Getting ASG names for ECS cluster ${clusterArn}`);

        try {
            const clusterResponse = await ecsAwsSdk.describeClusters({ clusters: [clusterArn] }).promise();
            const capacityProviders = clusterResponse.clusters[0].capacityProviders;

            const capacityProvidersResponse = await ecsAwsSdk.describeCapacityProviders({ capacityProviders }).promise();

            const asgNames = capacityProvidersResponse.capacityProviders.map(provider => {
                const asgArn = provider?.autoScalingGroupProvider?.autoScalingGroupArn;
                return asgArn?.split('/')?.pop();
            }).filter(Boolean);

            return asgNames;
        } catch (error) {
            logger.error(`EXEC_ID: ${runId} - Error retrieving ASG names for ECS cluster: ${error}`);
            return [];
        }
    }

    async function updateAutoScalingGroupCount(asgName, desiredCount) {
        logger.debug(`EXEC_ID: ${runId} - Updating ASG count for ${asgName}`);

        try {
            const asgResponse = await asgAwsSdk.describeAutoScalingGroups({
                AutoScalingGroupNames: [asgName]
            }).promise();

            if (asgResponse.AutoScalingGroups.length === 0) {
                logger.debug(`EXEC_ID: ${runId} - ASG "${asgName}" not found`);
                return;
            }

            const asg = asgResponse.AutoScalingGroups[0];

            if (asg.DesiredCapacity === desiredCount) {
                logger.debug(`EXEC_ID: ${runId} - ASG "${asgName}" is already at desired capacity: ${desiredCount}`);
                return;
            }

            const params = {
                AutoScalingGroupName: asgName,
                DesiredCapacity: desiredCount,
                MinSize: desiredCount,
            };
            await asgAwsSdk.updateAutoScalingGroup(params).promise();
            logger.info(`EXEC_ID: ${runId} - Updated ASG "${asgName}" to desired capacity: ${desiredCount}`);
        } catch (error) {
            logger.error(`EXEC_ID: ${runId} - Error updating ASG "${asgName}": ${error}`);
            throw error;
        }
    }



}


function isCurrentTimeInRange(starttime, endtime, timezone, days) {
    const now = moment().tz(timezone);
    const currentDay = now.format('ddd');
    const isActiveDay = Array.from(days).includes(currentDay);

    if (!isActiveDay) {
        return false;
    }

    // Create start and end times using the current date to ensure proper comparison
    const currentDate = now.format('YYYY-MM-DD');
    const startTimeToday = moment.tz(`${currentDate} ${starttime}`, "YYYY-MM-DD HH:mm:ss", timezone);
    const endTimeToday = moment.tz(`${currentDate} ${endtime}`, "YYYY-MM-DD HH:mm:ss", timezone);

    logger.debug(`Current Time: ${now.format()}`);
    logger.debug(`Start Time: ${startTimeToday.format()}`);
    logger.debug(`End Time: ${endTimeToday.format()}`);

    // Adjust for schedules that span over midnight
    if (endTimeToday.isBefore(startTimeToday)) {
        endTimeToday.add(1, 'day');
    }

    return now.isBetween(startTimeToday, endTimeToday);
}

