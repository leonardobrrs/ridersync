import { Module } from '@nestjs/common';
import { ArtistsController, MusicianProfileController } from './artists.controller';
import { ArtistsService } from './artists.service';

@Module({
  controllers: [MusicianProfileController, ArtistsController],
  providers: [ArtistsService],
  exports: [ArtistsService],
})
export class ArtistsModule {}
