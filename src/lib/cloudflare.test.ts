import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testCloudflareConnection, uploadImageToR2, provisionR2Infrastructure } from './actions';
import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

// Mock the S3 Client
vi.mock('@aws-sdk/client-s3', () => {
  const mockSend = vi.fn();
  return {
    S3Client: vi.fn(() => ({
      send: mockSend
    })),
    PutObjectCommand: vi.fn((args) => args),
    HeadBucketCommand: vi.fn((args) => args),
  };
});

describe('Cloudflare R2 Integration Architecture', () => {
  const mockEnv = {
    R2_ACCESS_KEY_ID: 'test-key',
    R2_SECRET_ACCESS_KEY: 'test-secret',
    R2_ENDPOINT: 'https://test.r2.cloudflarestorage.com',
    R2_BUCKET_NAME: 'test-bucket',
    R2_PUBLIC_URL: 'https://cdn.test.com'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...process.env, ...mockEnv };
  });

  it('testCloudflareConnection performs a valid HeadBucket handshake', async () => {
    const { S3Client } = await import('@aws-sdk/client-s3');
    const clientInstance = new S3Client({});
    (clientInstance.send as any).mockResolvedValueOnce({});

    const result = await testCloudflareConnection();
    
    expect(result.success).toBe(true);
    expect(clientInstance.send).toHaveBeenCalledWith(expect.any(Object));
  });

  it('provisionR2Infrastructure creates required folder structure markers', async () => {
    const { S3Client } = await import('@aws-sdk/client-s3');
    const clientInstance = new S3Client({});
    (clientInstance.send as any).mockResolvedValue({});

    const result = await provisionR2Infrastructure();
    
    expect(result.success).toBe(true);
    // Provision the three dedicated image folders.
    expect(clientInstance.send).toHaveBeenCalledTimes(3);
  });

  it('uploadImageToR2 correctly identifies the target category prefix', async () => {
    const { S3Client } = await import('@aws-sdk/client-s3');
    const clientInstance = new S3Client({});
    (clientInstance.send as any).mockResolvedValue({});

    const formData = new FormData();
    const mockFile = new File(['image-content'], 'test-image.jpg', { type: 'image/jpeg' });
    formData.append('file', mockFile);
    formData.append('category', 'products');

    const result = await uploadImageToR2(formData);

    expect(result.success).toBe(true);
    expect(result.url).toContain('products/');
    expect(clientInstance.send).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'test-bucket',
      ContentType: 'image/jpeg'
    }));
  });

  it('rejects unsupported upload MIME types before writing to R2', async () => {
    const formData = new FormData();
    formData.append('file', new File(['not-an-image'], 'payload.svg', { type: 'image/svg+xml' }));
    formData.append('category', 'system');

    const result = await uploadImageToR2(formData);

    expect(result.success).toBe(false);
    expect(result.message).toContain('R2_IMAGE_TYPE_NOT_SUPPORTED');
  });

  it('rejects image uploads larger than 8 MB', async () => {
    const formData = new FormData();
    formData.append('file', new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }));
    formData.append('category', 'system');

    const result = await uploadImageToR2(formData);

    expect(result.success).toBe(false);
    expect(result.message).toContain('R2_IMAGE_SIZE_LIMIT_8MB');
  });

  it('throws error if R2 secrets are missing from environment', async () => {
    process.env.R2_ACCESS_KEY_ID = '';
    
    const result = await testCloudflareConnection();
    expect(result.success).toBe(false);
    expect(result.message).toContain('R2_INFRASTRUCTURE_SECRETS_MISSING');
  });
});
