import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Upload,
  Button,
  message,
  Space,
  InputNumber,
  Select,
  Switch,
} from 'antd';
import { UploadOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { fileApi } from '../services/api';

interface FileUploadModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const FileUploadModal: React.FC<FileUploadModalProps> = ({
  visible,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const handleUpload = async () => {
    try {
      const values = await form.validateFields();
      
      if (fileList.length === 0) {
        message.error('Please select a file to upload');
        return;
      }

      setUploading(true);
      
      const file = fileList[0].originFileObj as File;
      const metadata: Record<string, any> = {};
      
      // Process custom metadata fields
      if (values.customFields) {
        values.customFields.forEach((field: any) => {
          if (field.key && field.value !== undefined) {
            metadata[field.key] = field.value;
          }
        });
      }

      // Add predefined fields
      if (values.author) metadata.author = values.author;
      if (values.description) metadata.description = values.description;
      if (values.tags) metadata.tags = values.tags;
      if (values.category) metadata.category = values.category;
      if (values.priority !== undefined) metadata.priority = values.priority;
      if (values.is_public !== undefined) metadata.is_public = values.is_public;

      const result = await fileApi.uploadFile(file, metadata);
      
      message.success(`File uploaded successfully! File ID: ${result.file_id}`);
      
      // Reset form and close modal
      form.resetFields();
      setFileList([]);
      onSuccess();
      onCancel();
      
    } catch (error: any) {
      console.error('Upload error:', error);
      message.error(error.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const uploadProps: UploadProps = {
    fileList,
    beforeUpload: (file) => {
      setFileList([file]);
      return false; // Prevent automatic upload
    },
    onRemove: () => {
      setFileList([]);
    },
    maxCount: 1,
  };

  const handleCancel = () => {
    form.resetFields();
    setFileList([]);
    onCancel();
  };

  return (
    <Modal
      title="Upload New File"
      open={visible}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button
          key="upload"
          type="primary"
          loading={uploading}
          onClick={handleUpload}
        >
          Upload File
        </Button>,
      ]}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="file"
          label="Select File"
          rules={[{ required: true, message: 'Please select a file' }]}
        >
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />}>Select File</Button>
          </Upload>
        </Form.Item>

        <Form.Item name="author" label="Author">
          <Input placeholder="Enter author name" />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea placeholder="Enter file description" rows={3} />
        </Form.Item>

        <Form.Item name="category" label="Category">
          <Select placeholder="Select category" allowClear>
            <Select.Option value="document">Document</Select.Option>
            <Select.Option value="image">Image</Select.Option>
            <Select.Option value="video">Video</Select.Option>
            <Select.Option value="audio">Audio</Select.Option>
            <Select.Option value="archive">Archive</Select.Option>
            <Select.Option value="other">Other</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="tags" label="Tags">
          <Input placeholder="Enter tags (comma separated)" />
        </Form.Item>

        <Form.Item name="priority" label="Priority">
          <InputNumber min={1} max={10} placeholder="1-10" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="is_public" label="Public File" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item label="Custom Metadata">
          <Form.List name="customFields">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'key']}
                      rules={[{ required: true, message: 'Missing field name' }]}
                    >
                      <Input placeholder="Field name" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'value']}
                      rules={[{ required: true, message: 'Missing field value' }]}
                    >
                      <Input placeholder="Field value" />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} />
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Custom Field
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default FileUploadModal;
