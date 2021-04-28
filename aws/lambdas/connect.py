import json

def lambda_handler(event, context):
    print('event:', json.dumps(event))
    bodyString = 'Please connect through websocket or the WebLine webapp'
    if 'requestContext' in event and 'connectionId' in event['requestContext']:
        bodyString = 'Hello from Lambda! Your connectionId is {}'.format(event['requestContext']['connectionId'])

    return {
        'statusCode': 200,
        'body': json.dumps(bodyString)
    }
