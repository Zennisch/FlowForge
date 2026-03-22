import { BadRequestException } from '@nestjs/common';
import { ValidateDagService } from './validate-dag.service';

describe('ValidateDagService', () => {
  let service: ValidateDagService;

  beforeEach(() => {
    service = new ValidateDagService();
  });

  describe('valid graphs', () => {
    it('should pass for empty steps and edges', () => {
      expect(() => service.validate([], [])).not.toThrow();
    });

    it('should pass for a single step with no edges', () => {
      expect(() => service.validate([{ id: 'a' }], [])).not.toThrow();
    });

    it('should pass for a linear workflow: a → b → c', () => {
      const steps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ];
      expect(() => service.validate(steps, edges)).not.toThrow();
    });

    it('should pass for a branched DAG: a → b, a → c, b → d, c → d', () => {
      const steps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
        { from: 'b', to: 'd' },
        { from: 'c', to: 'd' },
      ];
      expect(() => service.validate(steps, edges)).not.toThrow();
    });

    it('should pass for disconnected components (two isolated steps)', () => {
      const steps = [{ id: 'a' }, { id: 'b' }];
      expect(() => service.validate(steps, [])).not.toThrow();
    });
  });

  describe('cycle detection', () => {
    it('should throw BadRequestException for a self-loop: a → a', () => {
      expect(() =>
        service.validate([{ id: 'a' }], [{ from: 'a', to: 'a' }]),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for a 2-node cycle: a → b → a', () => {
      const steps = [{ id: 'a' }, { id: 'b' }];
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ];
      expect(() => service.validate(steps, edges)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for a 3-node cycle: a → b → c → a', () => {
      const steps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
      ];
      expect(() => service.validate(steps, edges)).toThrow(BadRequestException);
    });

    it('should include a descriptive message when a cycle is detected', () => {
      expect(() =>
        service.validate([{ id: 'x' }], [{ from: 'x', to: 'x' }]),
      ).toThrow('DAG validation failed');
    });
  });

  describe('edge endpoint validation', () => {
    it('should throw when edge.from references an unknown step id', () => {
      expect(() =>
        service.validate([{ id: 'a' }], [{ from: 'unknown', to: 'a' }]),
      ).toThrow(BadRequestException);
    });

    it('should throw when edge.to references an unknown step id', () => {
      expect(() =>
        service.validate([{ id: 'a' }], [{ from: 'a', to: 'unknown' }]),
      ).toThrow(BadRequestException);
    });

    it('should include the unknown id in the error message', () => {
      expect(() =>
        service.validate([{ id: 'a' }], [{ from: 'a', to: 'missing' }]),
      ).toThrow('"missing"');
    });
  });

  describe('duplicate step id validation', () => {
    it('should throw BadRequestException for duplicate step ids', () => {
      expect(() => service.validate([{ id: 'a' }, { id: 'a' }], [])).toThrow(
        BadRequestException,
      );
    });

    it('should include the duplicate id in the error message', () => {
      expect(() =>
        service.validate([{ id: 'dup' }, { id: 'dup' }], []),
      ).toThrow('"dup"');
    });
  });
});
