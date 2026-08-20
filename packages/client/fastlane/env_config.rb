# env_config.rb — the single source for identity and version values.
#
# Both Appfile and Fastfile require this file, so a value like the bundle
# identifier is written down exactly once: in the active .env file. Nothing
# in the fastlane layer carries its own default copy (axiom 2).

module EnvConfig
  CLIENT_DIR = File.expand_path("..", __dir__).freeze

  # The active .env file. ENVFILE selects it (relative paths resolve against
  # packages/client, which is where fastlane runs); otherwise fall back.
  def self.env_path
    raw = ENV["ENVFILE"]
    return default_env_file unless raw
    File.absolute_path?(raw) ? raw : File.join(CLIENT_DIR, raw)
  end

  # Parse the active .env file. ENVFILE selects which one; release lanes set
  # it to .env.production, local runs fall back to .env.
  def self.values
    @values ||= begin
      path = env_path
      raise "No env file found. Run `git secret reveal`." unless path && File.exist?(path)

      File.readlines(path).each_with_object({}) do |line, acc|
        line = line.strip
        next if line.empty? || line.start_with?("#") || !line.include?("=")
        key, value = line.split("=", 2)
        acc[key.strip] = value.strip
      end
    end
  end

  def self.default_env_file
    [".env.production", ".env"]
      .map { |f| File.join(CLIENT_DIR, f) }
      .find { |f| File.exist?(f) }
  end

  # The file wins over the process environment. That is the opposite of the
  # usual convention, and deliberate: fastlane auto-loads the *dev* .env via
  # dotenv, so BUILD_NUMBER and BACKEND_URL arrive in ENV already set to
  # development values. Letting ENV win meant ENVFILE=.env.production was
  # silently ignored and a release could be built against localhost.
  #
  # Select a different file with ENVFILE. Override a single value with
  # OVERRIDE_<KEY>, which dotenv cannot forge because no .env defines it.
  def self.fetch(key)
    value = ENV["OVERRIDE_#{key}"] || values[key] || ENV[key]
    raise "#{key} is not set in #{env_path} (nor as OVERRIDE_#{key})" if value.to_s.empty?
    value
  end

  def self.bundle_id = fetch("IOS_BUNDLE_ID")
  def self.version   = fetch("VERSION_NUMBER")
  def self.build     = fetch("BUILD_NUMBER")

  # Write a value back to the active .env file. react-native-config generates
  # ios/tmp.xcconfig from this file at build time, so a value only reaches
  # Info.plist by going through here — setting a process env var is not enough.
  def self.write(key, value)
    path = env_path
    lines = File.readlines(path)
    found = false
    lines.map! do |line|
      next line unless line.strip.start_with?("#{key}=")
      found = true
      "#{key}=#{value}\n"
    end
    lines << "#{key}=#{value}\n" unless found
    File.write(path, lines.join)
    @values = nil
    value
  end
end
