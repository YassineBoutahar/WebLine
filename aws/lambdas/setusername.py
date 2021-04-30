import json
import boto3

def lambda_handler(event, context):
    errorResponse = { 'statusCode': 400, 'body': json.dumps({"responseType": "usernameUnavailable"}) }
    print('event:', json.dumps(event))
    if 'body' in event and 'requestContext' in event and 'connectionId' in event['requestContext']:
        connectionId = event['requestContext']['connectionId']
        requestTime = event['requestContext']['requestTimeEpoch']
        errorResponse = { 'statusCode': 400, 'body': json.dumps({"responseType": "usernameUnavailable", "requestTime": requestTime}) }
        body = json.loads(event['body'])
        if not 'username':
            return errorResponse
        username = body['username']
        
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table('WebLinePeers')
        response = table.get_item(Key={'username': username})
        if 'Item' in response:
            return errorResponse
        
        response = table.put_item(Item={'username': username, 'connectionId': connectionId})

        return { 'statusCode': response['ResponseMetadata']['HTTPStatusCode'], 'body': json.dumps({"responseType": "usernameSet", "username": username, "requestTime": requestTime}) }
    else:
        return errorResponse