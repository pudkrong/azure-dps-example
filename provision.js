require("dotenv").config();
const { execFile } = require("node:child_process");
const mqtt = require("mqtt");
const { readFileSync, mkdirSync } = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { setTimeout } = require("node:timers/promises");
const provisioningServiceClient =
  require("azure-iot-provisioning-service").ProvisioningServiceClient;

const idScope = process.env.ID_SCOPE;
const globalDPS = process.env.GLOBAL_DPS;
const iotHub = process.env.IOTHUB;
const dpsConnectionString = process.env.DPS_CONNECTION_STRING;

const command = async ({ cmd, args }) =>
  new Promise((resolve, reject) => {
    // console.debug(`[${cmd}] »`, args);
    execFile(
      "openssl",
      args,
      {
        timeout: 60 * 1000,
      },
      (err, stdout, stderr) => {
        if (err !== null) {
          return reject(err);
        }
        if (stdout.length > 0) debug?.(`[${cmd}] «`, stdout);
        return resolve(stdout);
      }
    );
  });

const generateDeviceCertificates = async (deviceId) => {
  mkdirSync(path.join(__dirname, "certs"), {
    recursive: true,
  });

  const cert = path.join(__dirname, "certs", `${deviceId}-cert.pem`);
  const key = path.join(__dirname, "certs", `${deviceId}-key.pem`);
  const days = 365;

  await command({
    cmd: "openssl",
    args: [
      "req",
      "-outform",
      "PEM",
      "-x509",
      "-sha256",
      "-newkey",
      "rsa:4096",
      "-nodes",
      "-keyout",
      key,
      "-out",
      cert,
      "-days",
      days,
      "-extensions",
      "usr_cert",
      "-addext",
      "extendedKeyUsage=clientAuth",
      "-subj",
      `/CN=${deviceId}`,
    ],
  });

  return {
    cert,
    key,
  };
};

const enroll = async (cert, deviceId) => {
  const serviceClient =
    provisioningServiceClient.fromConnectionString(dpsConnectionString);

  const enrollment = {
    registrationId: deviceId,
    deviceID: deviceId,
    reprovisionPolicy: {
      migrateDeviceData: true,
      updateHubAssignment: true,
    },
    attestation: {
      type: "x509",
      x509: {
        clientCertificates: {
          primary: {
            certificate: readFileSync(cert).toString(),
          },
        },
      },
    },
  };

  const enrollmentResponse =
    await serviceClient.createOrUpdateIndividualEnrollment(enrollment);
  // console.log(enrollmentResponse.responseBody);
};

const register = async (cert, key, deviceId) => {
  const username = `${idScope}/registrations/${deviceId}/api-version=2019-03-31`;
  const client = mqtt.connect(`mqtts://${globalDPS}`, {
    clientId: deviceId,
    username,
    clean: true,
    rejectUnauthorized: false,
    cert: readFileSync(cert),
    key: readFileSync(key),
  });

  client
    .on("connect", () => {
      client.publish(
        `$dps/registrations/PUT/iotdps-register/?$rid=${randomBytes(8).toString(
          "hex"
        )}`,
        JSON.stringify({
          registrationId: deviceId,
        })
      );
    })
    .on("message", (topic, messageBuffer) => {
      const message = Buffer.from(messageBuffer).toString();
      const matches = /\$dps\/registrations\/res\/(?<statusCode>\d+)\//.exec(
        topic
      );
      if (matches?.groups?.statusCode !== "202") {
        console.error(`${deviceId} is failed to register`, message);
      }

      client.end();
    });

  client.subscribe("$dps/registrations/res/#");
};

const connect = async (cert, key, deviceId) => {
  const client = mqtt.connect(`mqtts://${iotHub}`, {
    clientId: deviceId,
    username: `${iotHub}/${deviceId}/?api-version=2021-04-12`,
    cert: readFileSync(cert),
    key: readFileSync(key),
    rejectUnauthorized: true,
  });

  client
    .on("connect", async () => {
      console.log(`${deviceId} can connect successfully`);

      await setTimeout(1000);
      client.end();
    })
    .on("reconnect", () => {
      console.log(`${deviceId} is trying to reconnect`);
    });
};

async function main() {
  const args = process.argv.slice(2);
  const deviceId =
    args?.[0] ?? `device-simulator-${randomBytes(4).toString("hex")}`;

  console.log(`generating certificates for ${deviceId}`);
  const certificates = await generateDeviceCertificates(deviceId);

  console.log(`enrolling ${deviceId}`);
  await enroll(certificates.cert, deviceId);

  console.log(`registering ${deviceId} to IoTHub`);
  await register(certificates.cert, certificates.key, deviceId);

  await setTimeout(5000);
  console.log(`testing device connection`);
  await connect(certificates.cert, certificates.key, deviceId);
}

main().catch(console.error);
