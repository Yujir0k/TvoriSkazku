export class LimitExceededError extends Error {
  constructor(resource: string) {
    const messages: Record<string, string> = {
      textGenerations: 'Лимит бесплатных сказок исчерпан',
      audioGenerations: 'Лимит бесплатной озвучки исчерпан',
    };
    super(messages[resource] || 'Лимит исчерпан');
    this.name = 'LimitExceededError';
  }
}
