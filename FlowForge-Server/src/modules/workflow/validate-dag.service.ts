import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class ValidateDagService {
  /**
   * Validates that the given steps and edges form a valid DAG:
   *  1. Step IDs are unique.
   *  2. All edge endpoints reference existing step IDs.
   *  3. The graph is acyclic (Kahn's topological-sort algorithm).
   */
  validate(
    steps: ReadonlyArray<{ id: string }>,
    edges: ReadonlyArray<{ from: string; to: string }>,
  ): void {
    // 1. Build step-ID set and check for duplicates
    const stepIds = new Set<string>();
    for (const step of steps) {
      if (stepIds.has(step.id)) {
        throw new BadRequestException(`Duplicate step id: "${step.id}"`);
      }
      stepIds.add(step.id);
    }

    // 2. Validate edge endpoints
    for (const edge of edges) {
      if (!stepIds.has(edge.from)) {
        throw new BadRequestException(
          `Edge references unknown step id: "${edge.from}"`,
        );
      }
      if (!stepIds.has(edge.to)) {
        throw new BadRequestException(
          `Edge references unknown step id: "${edge.to}"`,
        );
      }
    }

    // 3. Cycle detection via Kahn's algorithm
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const id of stepIds) {
      inDegree.set(id, 0);
      adjacency.set(id, []);
    }

    for (const edge of edges) {
      adjacency.get(edge.from)!.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    let visited = 0;
    while (queue.length > 0) {
      const node = queue.shift()!;
      visited++;
      for (const neighbor of adjacency.get(node) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    if (visited !== stepIds.size) {
      throw new BadRequestException(
        'Workflow steps contain a cycle — DAG validation failed',
      );
    }
  }
}
