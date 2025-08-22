import React, { useState, useEffect } from 'react';
import {
  Layout,
  Table,
  Button,
  Typography,
  Space,
  message,
  Tag,
  Statistic,
  Card,
  Row,
  Col,
  Tooltip,
  Input,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  ReloadOutlined,
  FileOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { fileApi, FileListItem } from './services/api';
import FileUploadModal from './components/FileUploadModal';
import FileDetailsModal from './components/FileDetailsModal';
import 'antd/dist/reset.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const App: React.FC = () => {
  const [files, setFiles] = useState<FileListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fileApi.listFiles(100);
      setFiles(response.files);
      setTotalCount(response.total_count);
    } catch (error: any) {
      console.error('Error fetching files:', error);
      message.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (fileId: string) => {
    setSelectedFileId(fileId);
    setDetailsModalVisible(true);
  };

  const handleUploadSuccess = () => {
    fetchFiles(); // Refresh the list after successful upload
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

  const getFileTypeIcon = (contentType?: string): React.ReactNode => {
    if (!contentType) return '📁';
    if (contentType.startsWith('image/')) return '🖼️';
    if (contentType.startsWith('video/')) return '🎥';
    if (contentType.startsWith('audio/')) return '🎵';
    if (contentType.includes('pdf')) return '📄';
    if (contentType.startsWith('text/')) return '📝';
    return '📁';
  };

  // Filter files based on search text
  const filteredFiles = files.filter(file =>
    file.file_name.toLowerCase().includes(searchText.toLowerCase()) ||
    file.file_id.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns: ColumnsType<FileListItem> = [
    {
      title: 'File',
      dataIndex: 'file_name',
      key: 'file_name',
      render: (text: string, record: FileListItem) => (
        <Space>
          <span style={{ fontSize: '16px' }}>
            {getFileTypeIcon(record.content_type)}
          </span>
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.file_id}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'file_size',
      key: 'file_size',
      render: (size: number) => formatFileSize(size),
      sorter: (a, b) => a.file_size - b.file_size,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
      filters: [
        { text: 'Processed', value: 'processed' },
        { text: 'Uploaded', value: 'uploaded' },
        { text: 'Processing', value: 'processing' },
        { text: 'Error', value: 'error' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Upload Date',
      dataIndex: 'upload_date',
      key: 'upload_date',
      render: (date: string) => formatDate(date),
      sorter: (a, b) => new Date(a.upload_date).getTime() - new Date(b.upload_date).getTime(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: FileListItem) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetails(record.file_id)}
        >
          View Details
        </Button>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <FileOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
            <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
              File Manager Service
            </Title>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setUploadModalVisible(true)}
            >
              Upload File
            </Button>
            <Tooltip title="Refresh">
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchFiles}
                loading={loading}
              />
            </Tooltip>
          </Space>
        </div>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Files"
                value={totalCount}
                prefix={<FileOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Processed Files"
                value={files.filter(f => f.status === 'processed').length}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Size"
                value={formatFileSize(files.reduce((sum, file) => sum + file.file_size, 0))}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        <Card>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>
              Files ({filteredFiles.length})
            </Title>
            <Input
              placeholder="Search files..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
              allowClear
            />
          </div>
          
          <Table
            columns={columns}
            dataSource={filteredFiles}
            rowKey="file_id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} files`,
            }}
            scroll={{ x: 800 }}
          />
        </Card>
      </Content>

      <FileUploadModal
        visible={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        onSuccess={handleUploadSuccess}
      />

      <FileDetailsModal
        visible={detailsModalVisible}
        fileId={selectedFileId}
        onCancel={() => {
          setDetailsModalVisible(false);
          setSelectedFileId(null);
        }}
      />
    </Layout>
  );
};

export default App;
