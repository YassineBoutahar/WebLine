import json
import boto3

def lambda_handler(event, context):
    errorResponse = { 'statusCode': 401 }
    print('event:', json.dumps(event))
    if 'body' in event and 'requestContext' in event and 'connectionId' in event['requestContext']:
        connectionId = event['requestContext']['connectionId']
        body = json.loads(event['body'])
        if not 'username' in body:
            return errorResponse
        username = body['username']
        
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table('WebLinePeers')
        response = table.get_item(Key={'username': username})
        if 'Item' in response and response['Item']['connectionId'] != connectionId:
            return errorResponse
        
        response = table.delete_item(Key={'username': username})

        return { 'statusCode': response['ResponseMetadata']['HTTPStatusCode'] }
    else:
        return errorResponse