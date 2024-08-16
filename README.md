# Azure IoT Hub Device Certificate Provisioning

This project provides a script to provision device certificates on Azure IoT Hub using a self-signed certificate. The provisioning is done through the Azure Device Provisioning Service (DPS). 

## Overview

The script automates the process of generating self-signed certificates for IoT devices, provisioning these devices to Azure IoT Hub via DPS, and then saving the generated certificates in a specified folder. The script is written in Node.js and leverages the Azure SDK to interact with Azure IoT services.

## How to Use

### 1. Configure Environment Variables
- Copy the provided `.env.example` file to `.env`.
- Open the `.env` file and fill in the required configuration parameters, such as Azure IoT Hub and DPS details.

### 2. Run the Script
- To provision a device, run the script using the following command:

  ```bash
  node provision.js <device>
  ```

  Replace `<device>` with the desired device ID.

- The script will generate the necessary certificates and store them in the `certs` folder.

### 3. Testing the Certificate

You can use any MQTT client to test the generated certificates. Below is an example using `mqttx`.

#### Testing Connection
To test the device's connection to Azure IoT Hub using the generated certificate, use the following command:

```bash
mqttx conn -V 3.1.1 \
  -h <iot_server> \
  -p 8883 \
  -i <device_id> \
  -u "<iot_server>/<device_id>/?api-version=2021-04-12" \
  --cert <device_cert> \
  --key <device_key>
```

- Replace `<iot_server>` with the IoT Hub hostname.
- Replace `<device_id>` with the device's ID.
- Replace `<device_cert>` and `<device_key>` with the paths to the generated certificate and private key, respectively.

#### Testing Subscription
To test the subscription to receive messages from Azure IoT Hub, run:

```bash
mqttx sub -V 3.1.1 \
  -h <iot_server> \
  -p 8883 \
  -i <device_id> \
  -u "<iot_server>/<device_id>/?api-version=2021-04-12" \
  --cert <device_cert> \
  --key <device_key> \
  --topic "devices/<device_id>/messages/devicebound/#"
```

This command subscribes the device to messages sent from Azure IoT Hub to the device.

#### Publishing a Message to the Device
You can use the Azure CLI to send a cloud-to-device message to your IoT device:

```bash
az iot device c2d-message send \
        --device-id <device_id> \
        --hub-name <iothub_name> \
        --data <message>
```

- Replace `<device_id>` with the ID of the target device.
- Replace `<iothub_name>` with the name of your IoT Hub.
- Replace `<message>` with the message payload you want to send.

## Folder Structure

- `certs/` - This folder will contain the generated certificates and keys for the devices.
- `.env.example` - Example environment configuration file.

## Dependencies

- Node.js
- Azure CLI (for testing cloud-to-device messaging)
- MQTT client (for testing MQTT connections)

## Conclusion

This project simplifies the process of provisioning and testing devices on Azure IoT Hub using self-signed certificates. By following the steps above, you can easily provision devices and verify their connectivity to Azure IoT services.