import asyncio
import bson
from .config import load_config
from nats.aio.client import Client as NATS

config = load_config()
nats_config = config["nats"]

class DAQClient:
    def __init__(self):
        """
        DAQClient for communicating with DAQ via NATS.
        """
        self.nats_server = nats_config["server"]
        self.request_subject = nats_config["request_subject"]
        self.nc = NATS()
        self.loop = asyncio.get_event_loop()

    async def connect(self):
        """Connect to NATS server."""
        await self.nc.connect(self.nats_server)

    async def send_command(self, function, require_response=True, **args):
        """
        Send a command to DAQ and handle the response.

        :param function: Function name to call on DAQ
        :param require_response: Whether a response is required
        :param args: Additional arguments for the function
        :return: Response from DAQ if required, None otherwise
        """
        command_data = {"func": function, "args": args}

        if require_response:
            response = await self.nc.request(self.request_subject, bson.dumps(command_data))
            return bson.loads(response.data)
        else:
            await self.nc.publish(self.request_subject, bson.dumps(command_data))
            return None

    async def close(self):
        """Close NATS connection."""
        await self.nc.close()

# Example Usage
async def main():
    client = DAQClient()
    await client.connect()
    response = await client.send_command("get_status")
    print("Response:", response)
    await client.close()

if __name__ == "__main__":
    asyncio.run(main())
