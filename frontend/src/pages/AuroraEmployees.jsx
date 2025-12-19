import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Table,
  Tag,
  Space,
  List,
  Checkbox,
  Divider,
} from 'antd';

import useLanguage from '@/locale/useLanguage';
import { request } from '@/request';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ONBOARDING', label: 'Onboarding' },
];

export default function AuroraEmployees() {
  const translate = useLanguage();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingChecklist, setOnboardingChecklist] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [form] = Form.useForm();
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [docForm] = Form.useForm();
  const [docFile, setDocFile] = useState(null);
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewForm] = Form.useForm();

  const fetchEmployees = async () => {
    setLoading(true);
    const res = await request.get({ entity: '/aurora/employees/list' });
    if (res?.success) {
      setEmployees(res.result || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const onCreate = async (values) => {
    const payload = {
      name: values.name,
      walletAddress: values.walletAddress,
      status: values.status,
    };
    const res = await request.post({
      entity: '/aurora/employees',
      jsonData: payload,
    });
    if (res?.success) {
      setModalOpen(false);
      form.resetFields();
      fetchEmployees();
    }
  };

  const columns = [
    {
      title: translate('Name'),
      dataIndex: ['metadata', 'name'],
      key: 'name',
      render: (value) => value || '-',
    },
    {
      title: translate('Wallet Address'),
      dataIndex: 'walletAddress',
      key: 'walletAddress',
      render: (value) => value || '-',
    },
    {
      title: translate('Status'),
      dataIndex: 'status',
      key: 'status',
      render: (value) => (
        <Tag color={value === 'ACTIVE' ? 'green' : value === 'ONBOARDING' ? 'blue' : 'default'}>
          {value}
        </Tag>
      ),
    },
    {
      title: translate('Actions'),
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openOnboarding(record)}>
            {translate('Onboarding')}
          </Button>
          <Button size="small" onClick={() => openDocuments(record)}>
            {translate('Documents')}
          </Button>
          <Button size="small" onClick={() => openReviews(record)}>
            {translate('Reviews')}
          </Button>
        </Space>
      ),
    },
  ];

  const openOnboarding = async (employee) => {
    setSelectedEmployee(employee);
    setOnboardingOpen(true);
    setOnboardingLoading(true);

    const res = await request.get({
      entity: `/aurora/onboarding/${employee.id}`,
    });

    if (res?.success) {
      setOnboardingChecklist(res.result);
    }
    setOnboardingLoading(false);
  };

  const openDocuments = async (employee) => {
    setSelectedEmployee(employee);
    setDocModalOpen(true);
    const res = await request.get({ entity: `/aurora/documents/${employee.id}` });
    if (res?.success) {
      setDocuments(res.result || []);
    }
  };

  const addDocument = async (values) => {
    if (!selectedEmployee || !docFile) return;

    const formData = new FormData();
    formData.append('employeeId', selectedEmployee.id);
    formData.append('type', values.type);
    formData.append('file', docFile);

    const res = await request.uploadFormData({
      entity: '/aurora/documents/upload',
      formData,
    });
    if (res?.success) {
      docForm.resetFields();
      setDocFile(null);
      const refresh = await request.get({ entity: `/aurora/documents/${selectedEmployee.id}` });
      if (refresh?.success) setDocuments(refresh.result || []);
    }
  };

  const openReviews = async (employee) => {
    setSelectedEmployee(employee);
    setReviewsModalOpen(true);
    const res = await request.get({ entity: `/aurora/reviews/${employee.id}` });
    if (res?.success) {
      setReviews(res.result || []);
    }
  };

  const addReview = async (values) => {
    if (!selectedEmployee) return;
    let ratingsObj = {};
    try {
      ratingsObj = values.ratingsJson ? JSON.parse(values.ratingsJson) : {};
    } catch (e) {
      // ignore parse errors
    }
    const payload = {
      employeeId: selectedEmployee.id,
      cycle: values.cycle,
      ratings: ratingsObj,
    };
    const res = await request.post({
      entity: '/aurora/reviews',
      jsonData: payload,
    });
    if (res?.success) {
      reviewForm.resetFields();
      const refresh = await request.get({ entity: `/aurora/reviews/${selectedEmployee.id}` });
      if (refresh?.success) setReviews(refresh.result || []);
    }
  };

  const ensureChecklist = async () => {
    if (onboardingChecklist) return onboardingChecklist;
    if (!selectedEmployee) return null;
    const res = await request.post({
      entity: '/aurora/onboarding',
      jsonData: { employeeId: selectedEmployee.id, tasks: [] },
    });
    if (res?.success) {
      setOnboardingChecklist(res.result);
      return res.result;
    }
    return null;
  };

  const addTask = async () => {
    const checklist = await ensureChecklist();
    if (!checklist || !newTaskName.trim()) return;

    const res = await request.post({
      entity: `/aurora/onboarding/${checklist._id}/tasks`,
      jsonData: { name: newTaskName.trim() },
    });
    if (res?.success) {
      setOnboardingChecklist(res.result);
      setNewTaskName('');
    }
  };

  const toggleTask = async (task) => {
    const checklist = await ensureChecklist();
    if (!checklist) return;

    const res = await request.patch({
      entity: `/aurora/onboarding/${checklist._id}/tasks/${task._id}`,
      jsonData: { completed: !task.completed },
    });
    if (res?.success) {
      setOnboardingChecklist(res.result);
    }
  };

  return (
    <Card
      title={translate('AuroraHR Employees')}
      extra={
        <Button type="primary" onClick={() => setModalOpen(true)}>
          {translate('Add Employee')}
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={employees}
        pagination={false}
      />

      <Modal
        open={modalOpen}
        title={translate('Add Employee')}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onCreate}>
          <Form.Item
            label={translate('Name')}
            name="name"
            rules={[{ required: true, message: translate('Please enter employee name') }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label={translate('Wallet Address')}
            name="walletAddress"
            rules={[{ required: false }]}
          >
            <Input placeholder="0x..." />
          </Form.Item>

          <Form.Item
            label={translate('Status')}
            name="status"
            initialValue="ONBOARDING"
            rules={[{ required: true, message: translate('Please select status') }]}
          >
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={onboardingOpen}
        title={
          selectedEmployee
            ? `${translate('Onboarding')} - ${selectedEmployee.metadata?.name || '-'}`
            : translate('Onboarding')
        }
        onCancel={() => setOnboardingOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            placeholder={translate('New task')}
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            onPressEnter={addTask}
          />
          <Button type="primary" onClick={addTask} disabled={!newTaskName.trim()}>
            {translate('Add Task')}
          </Button>

          <List
            loading={onboardingLoading}
            dataSource={onboardingChecklist?.tasks || []}
            locale={{ emptyText: translate('No tasks yet') }}
            renderItem={(item) => (
              <List.Item>
                <Checkbox checked={item.completed} onChange={() => toggleTask(item)}>
                  {item.name}
                </Checkbox>
              </List.Item>
            )}
          />
        </Space>
      </Modal>

      <Modal
        open={docModalOpen}
        title={
          selectedEmployee
            ? `${translate('Documents')} - ${selectedEmployee.metadata?.name || '-'}`
            : translate('Documents')
        }
        onCancel={() => setDocModalOpen(false)}
        footer={null}
        destroyOnClose
        width={700}
      >
        <Form form={docForm} layout="vertical" onFinish={addDocument}>
          <Form.Item
            label={translate('Type')}
            name="type"
            rules={[{ required: true, message: translate('Please enter document type') }]}
          >
            <Input placeholder="e.g. contract, ID, offer letter" />
          </Form.Item>
          <Form.Item
            label={translate('File')}
            name="file"
            rules={[{ required: true, message: translate('Please select a file') }]}
          >
            <Input
              type="file"
              onChange={(e) => {
                const file = e.target.files && e.target.files[0];
                setDocFile(file || null);
              }}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            {translate('Add Document')}
          </Button>
        </Form>

        <Divider />

        <List
          dataSource={documents}
          locale={{ emptyText: translate('No documents yet') }}
          renderItem={(item) => (
            <List.Item>
              <Space direction="vertical">
                <div>
                  <b>{item.type}</b>
                </div>
                <div>
                  {translate('IPFS')}: {item.ipfs_hash || '-'}
                </div>
                <div>
                  {translate('Signed At')}: {item.signed_at || '-'}
                </div>
              </Space>
            </List.Item>
          )}
        />
      </Modal>

      <Modal
        open={reviewsModalOpen}
        title={
          selectedEmployee
            ? `${translate('Reviews')} - ${selectedEmployee.metadata?.name || '-'}`
            : translate('Reviews')
        }
        onCancel={() => setReviewsModalOpen(false)}
        footer={null}
        destroyOnClose
        width={700}
      >
        <Form form={reviewForm} layout="vertical" onFinish={addReview}>
          <Form.Item
            label={translate('Cycle')}
            name="cycle"
            rules={[{ required: true, message: translate('Please enter review cycle') }]}
          >
            <Input placeholder="e.g. 2025-H1" />
          </Form.Item>
          <Form.Item label={translate('Ratings (JSON)')} name="ratingsJson">
            <Input.TextArea rows={3} placeholder='e.g. {"overall":5,"comment":"great"}' />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            {translate('Add Review')}
          </Button>
        </Form>

        <Divider />

        <List
          dataSource={reviews}
          locale={{ emptyText: translate('No reviews yet') }}
          renderItem={(item) => (
            <List.Item>
              <Space direction="vertical">
                <div>
                  <b>{item.cycle}</b>
                </div>
                <div>
                  {translate('Ratings')}: {JSON.stringify(item.ratings || {})}
                </div>
                <div>
                  {translate('Created')}: {item.createdAt || '-'}
                </div>
              </Space>
            </List.Item>
          )}
        />
      </Modal>
    </Card>
  );
}
