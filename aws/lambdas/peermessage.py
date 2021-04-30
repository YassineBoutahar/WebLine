import json
import boto3

def lambda_handler(event, context):
    errorResponse = { 'statusCode': 400, 'body': json.dumps('Message could not be sent.') }
    print('event:', json.dumps(event))
    if 'body' in event and 'requestContext' in event and 'connectionId' in event['requestContext']:
        connectionId = event['requestContext']['connectionId']
        domainName = event['requestContext']['domainName']
        stage = event['requestContext']['stage']
        requestTime = event['requestContext']['requestTimeEpoch']
        endpoint = 'https://' + domainName + '/' + stage
        body = json.loads(event['body'])
        if not 'peerConnectionId' in body or not 'message' in body or not 'messageType' in body:
            return errorResponse
        peerConnectionId = body['peerConnectionId']
        message = body['message']
        messageType = body['messageType']
        response = json.dumps({"senderConnectionId": connectionId, "messageType": messageType, "message": message, "responseType": "peerMessage", "requestTime": requestTime})

        client = boto3.client('apigatewaymanagementapi', endpoint_url=endpoint)
        client.post_to_connection(Data=response, ConnectionId=peerConnectionId)
        return { 'statusCode': 200 }
    else:
        return errorResponse