import React, { useState, useEffect } from 'react';
import {
  Modal,
  Descriptions,
  Spin,
  message,
  Tag,
  Typography,
  Divider,
  Card,
  Row,
  Col,
} from 'antd';
import {
  FileOutlined,
  CalendarOutlined,
  DatabaseOutlined,
  TagOutlined,
} from '@ant-design/icons';
import { fileApi, FileMetadata } from '../services/api';

const { Text, Title } = Typography;

interface FileDetailsModalProps {
  visible: boolean;
  fileId: string | null;
  onCancel: () => void;
}

// Helper function for Object.entries compatibility
function getObjectEntries<T>(obj: Record<string, T>): Array<[string, T]> {
  const keys = Object.keys(obj);
  const entries: Array<[string, T]> = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    entries.push([key, obj[key]]);
  }
  return entries;
}

const FileDetailsModal: React.FC<FileDetailsModalProps> = ({
  visible,
  fileId,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);

  useEffect(() => {
    if (visible && fileId) {
      fetchFileMetadata(fileId);
    }
  }, [visible, fileId]);

  const fetchFileMetadata = async (id: string) => {
    try {
      setLoading(true);
      const data = await fileApi.getFileMetadata(id);
      setMetadata(data);
    } catch (error: any) {
      console.error('Error fetching metadata:', error);
      message.error('Failed to load file metadata');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'processed': return 'green';
      case 'uploaded': return 'blue';
      case 'processing': return 'orange';
      case 'error': return 'red';
      default: return 'default';
    }
  };

  const renderClientMetadata = (clientMetadata: Record<string, any>) => {
    if (!clientMetadata || Object.keys(clientMetadata).length === 0) {
      return <Text type="secondary">No custom metadata</Text>;
    }

    const entries = getObjectEntries(clientMetadata);
    return (
      <Row gutter={[16, 8]}>
        {entries.map(([key, value]) => (
          <Col span={12} key={key}>
            <Text strong>{key}: </Text>
            <Text>{String(value)}</Text>
          </Col>
        ))}
      </Row>
    );
  };

  const renderExtractedMetadata = (data: FileMetadata) => {
    const allEntries = getObjectEntries(data);
    const extractedFields = allEntries
      .filter(([key]) => key.startsWith('extracted_'))
      .map(([key, value]) => ({
        key: key.replace('extracted_', '').replace(/_/g, ' '),
        value: String(value)
      }));

    if (extractedFields.length === 0) {
      return <Text type="secondary">No extracted metadata available</Text>;
    }

    return (
      <Row gutter={[16, 8]}>
        {extractedFields.map(({ key, value }) => (
          <Col span={12} key={key}>
            <Text strong>{key}: </Text>
            <Text>{value}</Text>
          </Col>
        ))}
      </Row>
    );
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileOutlined />
          <span>File Details</span>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      ) : metadata ? (
        <div>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="File Name" span={2}>
                <Text strong>{metadata.file_name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="File ID">
                <Text code>{metadata.file_id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(metadata.status)}>{metadata.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="File Size">
                {formatFileSize(metadata.file_size)}
              </Descriptions.Item>
              <Descriptions.Item label="Content Type">
                <Tag>{metadata.content_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Upload Date" span={2}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CalendarOutlined />
                  {formatDate(metadata.upload_date)}
                </div>
              </Descriptions.Item>
              {metadata.processing_date && (
                <Descriptions.Item label="Processing Date" span={2}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CalendarOutlined />
                    {formatDate(metadata.processing_date)}
                  </div>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="S3 Key" span={2}>
                <Text code style={{ fontSize: '12px' }}>{metadata.s3_key}</Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card 
            size="small" 
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TagOutlined />
                <span>Custom Metadata</span>
              </div>
            }
            style={{ marginBottom: 16 }}
          >
            {renderClientMetadata(metadata.client_metadata || {})}
          </Card>

          <Card 
            size="small" 
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DatabaseOutlined />
                <span>Extracted Metadata</span>
              </div>
            }
          >
            {renderExtractedMetadata(metadata)}
          </Card>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Text type="secondary">No metadata available</Text>
        </div>
      )}
    </Modal>
  );
};

export default FileDetailsModal;
