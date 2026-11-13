import {Module} from '@nestjs/common';
import {DatabaseModule} from '../database/database.module.js';
import {CommentaryController} from './commentary.controller.js';
import {CommentaryService} from './commentary.service.js';
@Module({imports:[DatabaseModule],controllers:[CommentaryController],providers:[CommentaryService]})
export class CommentaryModule {}
