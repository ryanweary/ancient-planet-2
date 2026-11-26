// Percentage-closer soft shadows for the (orthographic) sun, adapted from the three.js PCSS example (MIT).
// Penumbra width grows with blocker->receiver distance: crisp contact shadows, soft far edges.
const PCSS = `
#define PCSS_SAMPLES 17
#define PCSS_RINGS 11
#define PCSS_DEPTH_RANGE 39.0
#define PCSS_FRUSTUM_W 16.0
#define PCSS_SOFT 0.09
vec2 pcssDisk[PCSS_SAMPLES];
void pcssInit( const in vec2 seed ) {
  float ANGLE_STEP = PI2 * float( PCSS_RINGS ) / float( PCSS_SAMPLES ); float INV = 1.0 / float( PCSS_SAMPLES );
  float angle = rand( seed ) * PI2; float radius = INV;
  for ( int i = 0; i < PCSS_SAMPLES; i ++ ) { pcssDisk[ i ] = vec2( cos( angle ), sin( angle ) ) * pow( radius, 0.75 ); radius += INV; angle += ANGLE_STEP; }
}
float pcssBlocker( sampler2D sm, vec2 uv, float zR ) {
  float sum = 0.0; int n = 0;
  for ( int i = 0; i < PCSS_SAMPLES; i ++ ) { float d = unpackRGBAToDepth( texture2D( sm, uv + pcssDisk[ i ] * 0.008 ) ); if ( d < zR ) { sum += d; n ++; } }
  return n == 0 ? -1.0 : sum / float( n );
}
float pcssFilter( sampler2D sm, vec2 uv, float zR, float r ) {
  float s = 0.0;
  for ( int i = 0; i < PCSS_SAMPLES; i ++ ) {
    if ( zR <= unpackRGBAToDepth( texture2D( sm, uv + pcssDisk[ i ] * r ) ) ) s += 1.0;
    if ( zR <= unpackRGBAToDepth( texture2D( sm, uv - pcssDisk[ i ].yx * r ) ) ) s += 1.0;
  }
  return s / ( 2.0 * float( PCSS_SAMPLES ) );
}
float PCSS( sampler2D sm, vec4 c ) {
  pcssInit( c.xy );
  float zB = pcssBlocker( sm, c.xy, c.z );
  if ( zB < 0.0 ) return 1.0;
  float r = clamp( ( c.z - zB ) * PCSS_DEPTH_RANGE * PCSS_SOFT / PCSS_FRUSTUM_W, 0.0006, 0.01 );
  return pcssFilter( sm, c.xy, c.z, r );
}
`;
export function PCSS_CHUNK(orig) {
  let s = orig.replace('#ifdef USE_SHADOWMAP', '#ifdef USE_SHADOWMAP\n' + PCSS);
  s = s.replace('#if defined( SHADOWMAP_TYPE_PCF )', 'return mix( 1.0, PCSS( shadowMap, shadowCoord ), shadowIntensity );\n#if defined( SHADOWMAP_TYPE_PCF )');
  return s;
}
