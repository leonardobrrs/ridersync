import { Controller, Get, Module, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AL_CITIES, BAND_POSITIONS, CITY_SUGGESTIONS, FORMATS, GENRES, INSTRUMENTS, PAYMENT_TYPES, UF, VENUE_KINDS } from '../../common/domain-lists';
import { ApiZodQuery, ZQuery } from '../../common/zod';
import { Public } from '../auth/auth.decorators';
import { EventsModule } from '../events/events.module';
import { RidersModule } from '../riders/riders.module';
import { ArtistSearchSchema, MarketplaceService, VenueSearchSchema } from './marketplace.service';

@ApiTags('public')
@Public()
@Controller('public')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get('home')
  home() {
    return this.marketplace.home();
  }

  @Get('artists')
  @ApiZodQuery(ArtistSearchSchema)
  artists(@ZQuery(ArtistSearchSchema) q: z.infer<typeof ArtistSearchSchema>) {
    return this.marketplace.searchArtists(q);
  }

  @Get('artists/:slug')
  artist(@Param('slug') slug: string) {
    return this.marketplace.publicArtist(slug.slice(0, 80));
  }

  @Get('venues')
  @ApiZodQuery(VenueSearchSchema)
  venues(@ZQuery(VenueSearchSchema) q: z.infer<typeof VenueSearchSchema>) {
    return this.marketplace.searchVenues(q);
  }

  @Get('venues/:slug')
  venue(@Param('slug') slug: string) {
    return this.marketplace.publicVenue(slug.slice(0, 80));
  }

  @Get('meta')
  meta() {
    return {
      genres: GENRES,
      formats: FORMATS,
      instruments: INSTRUMENTS,
      venueKinds: VENUE_KINDS,
      paymentTypes: PAYMENT_TYPES,
      cities: CITY_SUGGESTIONS,
      allCities: AL_CITIES,
      states: UF,
      bandPositions: BAND_POSITIONS,
    };
  }
}

@Module({ imports: [EventsModule, RidersModule], controllers: [MarketplaceController], providers: [MarketplaceService] })
export class MarketplaceModule {}
