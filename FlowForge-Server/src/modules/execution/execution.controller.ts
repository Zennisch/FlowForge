import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListExecutionEventsQueryDto } from './dto/list-execution-events-query.dto';
import { ExecutionSummaryQueryDto } from './dto/execution-summary-query.dto';
import { ListExecutionsQueryDto } from './dto/list-executions-query.dto';
import { SetLegalHoldDto } from './dto/set-legal-hold.dto';
import { TriggerExecutionDto } from './dto/trigger-execution.dto';
import { ExecutionService } from './execution.service';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller()
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Post('workflows/:workflowId/trigger')
  @HttpCode(HttpStatus.CREATED)
  trigger(
    @Param('workflowId') workflowId: string,
    @Body() dto: TriggerExecutionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.executionService.trigger(workflowId, req.user.id, dto);
  }

  @Get('executions')
  findAll(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: ListExecutionsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.executionService.findAll(req.user.id, query);
  }

  @Get('executions/summary')
  findSummary(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: ExecutionSummaryQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.executionService.findSummary(req.user.id, query);
  }

  @Get('executions/:id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.executionService.findOne(id, req.user.id);
  }

  @Get('executions/:id/legal-hold')
  getLegalHold(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.executionService.getLegalHold(id, req.user.id);
  }

  @Post('executions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.executionService.cancel(id, req.user.id);
  }

  @Get('executions/:id/events')
  findEvents(
    @Param('id') id: string,
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: ListExecutionEventsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.executionService.findEvents(id, req.user.id, query);
  }

  @Post('executions/:id/legal-hold')
  @HttpCode(HttpStatus.OK)
  setLegalHold(
    @Param('id') id: string,
    @Body() dto: SetLegalHoldDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.executionService.setLegalHold(id, req.user.id, dto.reason);
  }

  @Delete('executions/:id/legal-hold')
  @HttpCode(HttpStatus.OK)
  releaseLegalHold(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.executionService.releaseLegalHold(id, req.user.id);
  }
}
