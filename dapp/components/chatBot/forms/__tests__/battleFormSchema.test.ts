import { battleFormSchema, defaultFormData } from '../battleFormSchema';

describe('battleFormSchema', () => {
  it('accepts defaultFormData', () => {
    const result = battleFormSchema.safeParse(defaultFormData);
    expect(result.success).toBe(true);
  });

  it('rejects values exceeding max length', () => {
    const tooLong = 'x'.repeat(51); // 50 max for several fields
    const data = {
      user: { ...defaultFormData.user, favoriteBlockchains: tooLong },
      chatbot: { ...defaultFormData.chatbot },
    };
    const result = battleFormSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('allows optional fields to be omitted', () => {
    const result = battleFormSchema.safeParse({
      user: {},       // all optional
      chatbot: {},    // all optional
    });
    expect(result.success).toBe(true);
  });
});
