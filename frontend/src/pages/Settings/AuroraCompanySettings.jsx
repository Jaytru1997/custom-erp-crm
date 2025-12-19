import { Form, Input, Button, Card } from 'antd';

import useLanguage from '@/locale/useLanguage';
import SetingsSection from '@/modules/SettingModule/components/SetingsSection';
import { request } from '@/request';

export default function AuroraCompanySettings() {
  const [form] = Form.useForm();
  const translate = useLanguage();

  const onFinish = async (values) => {
    await request.post({
      entity: '/aurora/company',
      jsonData: values,
    });
  };

  return (
    <SetingsSection
      title={translate('AuroraHR Company')}
      description={translate('Configure your AuroraHR company profile and treasury.')}
    >
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ country: 'Nigeria' }}
        >
          <Form.Item
            label={translate('Company Name')}
            name="name"
            rules={[{ required: true, message: translate('Please enter company name') }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label={translate('Country')}
            name="country"
            rules={[{ required: true, message: translate('Please enter country') }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label={translate('Treasury Safe Address')}
            name="treasurySafeAddress"
          >
            <Input placeholder="0x..." />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              {translate('Save AuroraHR Company')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </SetingsSection>
  );
}


