import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  type PutObjectCommandInput,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export interface StorageConfig {
  endpoint: string
  bucket: string
  accessKey: string
  secretKey: string
  region: string
}

export function createStorageClient(config: StorageConfig) {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    forcePathStyle: true,
  })

  return {
    async put(key: string, body: string | Buffer | Uint8Array, contentType = 'application/octet-stream'): Promise<void> {
      const input: PutObjectCommandInput = {
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }
      await client.send(new PutObjectCommand(input))
    },

    async get(key: string): Promise<Buffer> {
      const command = new GetObjectCommand({ Bucket: config.bucket, Key: key })
      const response: GetObjectCommandOutput = await client.send(command)
      if (!response.Body) throw new Error(`S3 object ${key} has no body`)
      const chunks: Uint8Array[] = []
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk)
      }
      return Buffer.concat(chunks)
    },

    async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
      const command = new GetObjectCommand({ Bucket: config.bucket, Key: key })
      return getSignedUrl(client, command, { expiresIn })
    },
  }
}

export type StorageClient = ReturnType<typeof createStorageClient>
